import log from '../src/utils/logger';
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, FileClock } from 'lucide-react';
import { AuditLogEntry, Role, Permission } from '../types';
import { useAuth } from '../src/context/AuthContext';
import { subscribeToAuditLogs } from '../src/services/auditService';

interface AdminAuditLogPageProps {
    userRole?: Role;
    isSuperAdmin?: boolean;
}

const AdminAuditLogPage: React.FC<AdminAuditLogPageProps> = ({ userRole, isSuperAdmin }) => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterModule, setFilterModule] = useState<string>('ALL');
    const [filterAction, setFilterAction] = useState<string>('ALL');
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─── Data Subscription ────────────────────────────────────────────────────
    useEffect(() => {
        let filter: { actorId?: string } | undefined;

        const hasFullAccess =
            isSuperAdmin ||
            userRole?.permissions.includes(Permission.MANAGE_SYSTEM) ||
            userRole?.permissions.includes(Permission.VIEW_AUDIT_LOGS);

        const currentUid = user?.id || (user as any)?.uid || (user as any)?.portalId;
        if (!hasFullAccess && currentUid) {
            filter = { actorId: currentUid };
        }

        log.log("Audit Log Subscription - Has Full Access:", hasFullAccess, "Filter:", filter);

        const unsubscribe = subscribeToAuditLogs((logs) => {
            setAuditLogs(logs);
            setIsLoading(false);
        }, 100, filter);
        return () => unsubscribe();
    }, [user, userRole, isSuperAdmin]);

    const filteredLogs = useMemo(() => {
        return auditLogs.filter(entry => {
            const detailsText = String(entry.details || (entry as any).description || '');
            const actorText = String(entry.actorName || (entry as any).performedBy || (entry as any).actorEmail || 'System');
            const moduleText = String(entry.targetModule || (entry as any).module || (entry as any).category || 'SYSTEM');
            const actionText = String(entry.actionType || (entry as any).action || 'LOG');

            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                detailsText.toLowerCase().includes(searchLower) ||
                actorText.toLowerCase().includes(searchLower) ||
                moduleText.toLowerCase().includes(searchLower) ||
                actionText.toLowerCase().includes(searchLower);
            const matchesModule = filterModule === 'ALL' || moduleText.toUpperCase() === filterModule.toUpperCase();
            const matchesAction = filterAction === 'ALL' || actionText.toUpperCase() === filterAction.toUpperCase();
            return matchesSearch && matchesModule && matchesAction;
        });
    }, [auditLogs, searchTerm, filterModule, filterAction]);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'text-green-600 bg-green-50 border-green-200';
            case 'DELETE': return 'text-red-600 bg-red-50 border-red-200';
            case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'APPROVAL': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'REJECTION': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'STATUS_CHANGE': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'SUBMIT': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
            case 'EXPORT': return 'text-teal-600 bg-teal-50 border-teal-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center">
                            <FileClock className="mr-2 text-slate-600" /> System Audit Logs
                        </h2>
                        <p className="text-sm text-gray-500">Track administrative actions and system changes.</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-grow relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Search logs by user or details..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-56 relative">
                        <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <select
                            className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                            value={filterModule}
                            onChange={e => setFilterModule(e.target.value)}
                        >
                            <option value="ALL">All Modules</option>
                            <option value="EMPLOYEES">Employees</option>
                            <option value="SUBMISSION">Submissions</option>
                            <option value="LEAVES">Leaves</option>
                            <option value="BGV">Background Verification</option>
                            <option value="INVITES">Referral Invites</option>
                            <option value="DISCIPLINARY">Disciplinary</option>
                            <option value="STAFF">Staff</option>
                            <option value="ROLES">Roles</option>
                            <option value="SITES">Sites</option>
                            <option value="AUTH">Authentication & Security</option>
                            <option value="SETTINGS">Settings</option>
                            <option value="SYSTEM">System</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            {/* Hidden column header — only shows in privilege mode */}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">Loading...</td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">No logs found matching criteria.</td></tr>
                        ) : (
                            filteredLogs.map(entry => (
                                <tr key={entry.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(entry.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {entry.actorName || (entry as any).performedBy || (entry as any).actorEmail || 'System'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-bold rounded border ${getActionColor(entry.actionType || (entry as any).action)}`}>
                                            {entry.actionType || (entry as any).action || 'LOG'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {entry.targetModule || (entry as any).module || (entry as any).category || 'SYSTEM'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        <span>
                                            {entry.details || (entry as any).description || '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminAuditLogPage;
