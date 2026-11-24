import log from "@/src/utils/logger";
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, UserType } from '../../../types';

import { useAuth } from '../../context/AuthContext';

interface AuthGuardProps {
    children: React.ReactNode;
    allowedUserTypes?: UserType[];
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, allowedUserTypes }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    log.log(`AuthGuard [${location.pathname}]: user=${user?.name} (${user?.type}), loading=${loading}`);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const isPublicOrGuest = !user || user.type === UserType.PUBLIC || (user as any).roleId === 'guest';

    if (isPublicOrGuest) {
        const isPathAdmin = location.pathname.startsWith('/admin');
        const baseLogin = isPathAdmin ? '/admin/login' : '/login';
        const currentPath = location.pathname + location.search;
        const loginUrl = currentPath && currentPath !== '/' && currentPath !== '/login' && currentPath !== '/employee/login'
            ? `${baseLogin}?redirect=${encodeURIComponent(currentPath)}`
            : baseLogin;
        console.warn(`AuthGuard: Guest or unauthenticated user on protected path ${location.pathname}. Redirecting to ${loginUrl}`);
        return <Navigate to={loginUrl} state={{ from: location }} replace />;
    }

    if (allowedUserTypes && !allowedUserTypes.includes(user.type as UserType)) {
        const isPathAdmin = location.pathname.startsWith('/admin');
        const isPathEmployee = location.pathname.startsWith('/employee');
        let redirectPath = '/';
        if (user.type === UserType.ADMIN) {
            redirectPath = '/admin/dashboard';
        } else if (user.type === UserType.EMPLOYEE) {
            redirectPath = '/employee/dashboard';
        } else {
            redirectPath = isPathAdmin ? '/admin/login' : (isPathEmployee ? '/employee/login' : '/login');
        }
        console.warn(`AuthGuard: User type ${user.type} not allowed for path ${location.pathname}. Redirecting to ${redirectPath}`);
        return <Navigate to={redirectPath} replace />;
    }

    log.log(`AuthGuard: Access granted for ${user.name} to ${location.pathname}`);
    return <>{children}</>;
};

export default AuthGuard;
