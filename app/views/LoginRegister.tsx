'use client';

import React, { useState } from 'react';
import { useApp, User, Role, generateId } from '../store/AppContext';

export default function LoginRegister() {
    const { state, dispatch } = useApp();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    
    // Register Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('Tester');
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSelectUser = (user: User) => {
        dispatch({ type: 'SET_CURRENT_USER', payload: user });
    };

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!name.trim() || !email.trim()) {
            setErrorMsg('Please fill in all required fields.');
            return;
        }

        // Email validation
        if (!/^[^\s@]+@qacopilot\.com$/i.test(email)) {
            setErrorMsg('Please enter a valid @qacopilot.com email address.');
            return;
        }

        // Check if email already exists
        if (state.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            setErrorMsg('A user with this email address already exists.');
            return;
        }

        const newUser: User = {
            id: generateId(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            teamIds: role === 'Admin' ? [] : selectedTeamIds,
        };

        // Add to users database
        dispatch({ type: 'ADD_USER', payload: newUser });
        
        // Log in automatically as the newly registered user
        dispatch({ type: 'SET_CURRENT_USER', payload: newUser });
    };

    const toggleTeamSelection = (teamId: string) => {
        setSelectedTeamIds(prev => 
            prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
        );
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #090d16 0%, #111827 50%, #070b12 100%)',
            color: 'var(--color-text-primary)',
            padding: '24px',
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            overflowY: 'auto'
        }}>
            {/* Background elements for premium aesthetic */}
            <div style={{
                position: 'absolute', top: '10%', left: '15%', width: '350px', height: '350px',
                background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute', bottom: '10%', right: '15%', width: '400px', height: '400px',
                background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none'
            }} />

            <div style={{
                width: '100%',
                maxWidth: isRegisterMode ? '640px' : '540px',
                background: 'rgba(17, 24, 39, 0.75)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                padding: '40px',
                position: 'relative',
                zIndex: 10,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                {/* Logo & Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', boxShadow: '0 0 20px rgba(139,92,246,0.4)', fontSize: '28px', marginBottom: '16px' }}>
                        🚀
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', background: 'linear-gradient(90deg, #f1f5f9, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Antigravity QA Copilot
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>
                        Enterprise-Grade Test Intelligence & Ticket Sync
                    </p>
                </div>

                {!isRegisterMode ? (
                    /* LOGIN VIEW */
                    <div>
                        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>
                                Choose a Testing Profile
                            </h2>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                                Quick-log in as any workspace resource to test team-based RBAC folder access.
                            </p>
                        </div>

                        {/* Profiles Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                            {state.users.map(user => {
                                const isUserAdmin = user.role === 'Admin';
                                return (
                                    <div 
                                        key={user.id} 
                                        onClick={() => handleSelectUser(user)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '16px 20px',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255, 255, 255, 0.06)',
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)';
                                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: isUserAdmin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                border: `1px solid ${isUserAdmin ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                                                color: isUserAdmin ? '#ef4444' : '#3b82f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '18px',
                                                fontWeight: 700
                                            }}>
                                                {user.name.charAt(0)}
                                            </div>
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>{user.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{user.email}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                background: isUserAdmin ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                                color: isUserAdmin ? '#f87171' : '#60a5fa',
                                                border: `1px solid ${isUserAdmin ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
                                                padding: '2px 8px',
                                                borderRadius: '20px'
                                            }}>
                                                {user.role}
                                            </span>
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginLeft: '4px' }}>→</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Switch button to Register */}
                        <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Need a custom tester profile?</span>
                            <button 
                                onClick={() => setIsRegisterMode(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#8b5cf6',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    marginLeft: '6px',
                                    textDecoration: 'underline'
                                }}
                            >
                                Register New Profile
                            </button>
                        </div>
                    </div>
                ) : (
                    /* REGISTER VIEW */
                    <form onSubmit={handleRegister}>
                        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>
                                Register New Tester Profile
                            </h2>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
                                Create a custom user account, assign a role, and map them to QA teams.
                            </p>
                        </div>

                        {errorMsg && (
                            <div style={{
                                padding: '12px 16px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '12px',
                                color: '#f87171',
                                fontSize: '13px',
                                marginBottom: '20px',
                                textAlign: 'left'
                            }}>
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                                    Full Name *
                                </label>
                                <input 
                                    className="form-input"
                                    type="text" 
                                    placeholder="e.g. John Doe"
                                    value={name} 
                                    onChange={e => setName(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
                                    required
                                />
                            </div>

                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                                    Email Address *
                                </label>
                                <input 
                                    className="form-input"
                                    type="email" 
                                    placeholder="johndoe@qacopilot.com"
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
                                    required
                                />
                            </div>

                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                                    System Role *
                                </label>
                                <select 
                                    className="form-select"
                                    value={role} 
                                    onChange={e => setRole(e.target.value as Role)}
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
                                >
                                    <option value="Tester">Tester (Execute test cases and report bugs)</option>
                                    <option value="Lead">Lead (Manage test cases, delete, full write access)</option>
                                    <option value="Admin">Admin (Bypasses team checks, global permissions)</option>
                                </select>
                            </div>

                            {role !== 'Admin' && (
                                <div style={{ textAlign: 'left' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                                        Assign Team Folders (Select Team Assignments)
                                    </label>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        maxHeight: '140px',
                                        overflowY: 'auto',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'rgba(0,0,0,0.15)'
                                    }}>
                                        {state.teams.map(team => (
                                            <label 
                                                key={team.id} 
                                                style={{ 
                                                    display: 'flex', 
                                                    gap: '10px', 
                                                    alignItems: 'center', 
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    color: selectedTeamIds.includes(team.id) ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                                    padding: '2px 0'
                                                }}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    className="table-checkbox"
                                                    checked={selectedTeamIds.includes(team.id)} 
                                                    onChange={() => toggleTeamSelection(team.id)} 
                                                />
                                                <span>{team.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '6px' }}>
                                        💡 Members will only be allowed to view folders and test cases assigned to their respective teams.
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Form Buttons */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                            <button 
                                type="button"
                                className="btn btn-outline" 
                                style={{ flex: 1 }}
                                onClick={() => {
                                    setIsRegisterMode(false);
                                    setErrorMsg('');
                                }}
                            >
                                Back to Log In
                            </button>
                            <button 
                                type="submit"
                                className="btn btn-primary" 
                                style={{ flex: 1, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', border: 'none' }}
                            >
                                Create & Log In
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
