import { db, auth, functions } from '../firebase/config';
import {
    collection,
    doc,
    setDoc,
    query,
    orderBy,
    onSnapshot,
    limit,
    serverTimestamp,
    Timestamp,
    deleteDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AuditLogEntry } from '../../types';

const AUDIT_LOGS_COLLECTION = 'audit_logs';

/** Generate a unique ID to avoid Firestore SDK retry collisions with addDoc */
const generateUniqueId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const timestamp = Date.now().toString(36);
    let result = timestamp + '_';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// CLOUD-6: Server-Enforced Audit Event Callable
export const logClientAuditEvent = async (params: {
    action: string;
    module: string;
    details: string;
    targetId?: string;
}): Promise<{ success: boolean; logId?: string }> => {
    const fn = httpsCallable<any, any>(functions, 'logClientAuditEvent');
    const res = await fn(params);
    return res.data;
};

export const logSystemAction = async (
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'APPROVAL' | 'REJECTION' | 'LOGIN' | 'LOGOUT' | 'SUBMIT' | 'EXPORT',
    targetModule: 'SITES' | 'STAFF' | 'ROLES' | 'LEAVES' | 'EMPLOYEES' | 'SYSTEM' | 'AUTH' | 'SUBMISSION' | 'BGV' | 'INVITES' | 'DISCIPLINARY' | 'SETTINGS',
    details: string,
    actorOverride?: { id: string; name: string }
) => {
    try {
        const currentUser = auth.currentUser;
        // Safeguard: audit_logs is strictly reserved for authenticated staff/admin actions.
        // Public/guest candidate actions are tracked directly in their respective collections
        // (e.g. onboarding_submissions) to prevent unauthorized writes and audit log flooding.
        if (!currentUser || currentUser.isAnonymous || actorOverride?.id === 'guest') {
            return;
        }

        // CLOUD-6: Route through server-enforced callable that stamps verified UID, IP, and timestamp
        await logClientAuditEvent({
            action: actionType,
            module: targetModule,
            details,
            targetId: actorOverride?.id
        });
    } catch (error) {
        console.warn("Audit log notice (server callable):", error);
    }
};

export const subscribeToAuditLogs = (callback: (logs: AuditLogEntry[]) => void, limitCount = 100, filter?: { actorId?: string }) => {
    // Server-side actor filtering when actorId is specified (UDF-AUD-309)
    let q = filter?.actorId 
        ? query(
            collection(db, AUDIT_LOGS_COLLECTION),
            where('actorId', '==', filter.actorId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
          )
        : query(
            collection(db, AUDIT_LOGS_COLLECTION),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
          );

    return onSnapshot(q, (snapshot) => {
        let logs = snapshot.docs.map(doc => {
            const data = doc.data();
            const ts = data.timestamp as Timestamp;
            return {
                id: doc.id,
                actionType: data.actionType || data.action || 'LOG',
                targetModule: data.targetModule || data.module || data.category || 'SYSTEM',
                details: data.details || data.description || '',
                targetId: data.targetId || null,
                actorId: data.actorId || 'system',
                actorName: data.actorName || data.performedBy || data.actorEmail || 'System',
                actorRole: data.actorRole || 'Staff',
                ...data,
                timestamp: ts?.toDate ? ts.toDate().toISOString() : (data.timestamp || new Date().toISOString())
            };
        }) as AuditLogEntry[];

        if (filter?.actorId) {
            logs = logs.filter(log => log.actorId === filter.actorId);
        }

        callback(logs);
    }, (error) => {
        console.error("Audit Log Subscription Error:", error);
    });
};


