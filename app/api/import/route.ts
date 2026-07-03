import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const jsonData = formData.get('data') as string | null;

        let testCases: Record<string, unknown>[] = [];

        if (file) {
            const text = await file.text();
            const ext = file.name.split('.').pop()?.toLowerCase();

            if (ext === 'csv') {
                testCases = parseCSV(text);
            } else if (ext === 'json') {
                try {
                    const parsed = JSON.parse(text);
                    testCases = Array.isArray(parsed) ? parsed : parsed.testCases || [];
                } catch {
                    return NextResponse.json({ error: 'Invalid JSON file format' }, { status: 400 });
                }
            } else {
                return NextResponse.json({ error: 'Unsupported file format. Use CSV or JSON.' }, { status: 400 });
            }
        } else if (jsonData) {
            try {
                const parsed = JSON.parse(jsonData);
                testCases = Array.isArray(parsed) ? parsed : parsed.testCases || [];
            } catch {
                return NextResponse.json({ error: 'Invalid JSON data' }, { status: 400 });
            }
        } else {
            return NextResponse.json({ error: 'No file or data provided' }, { status: 400 });
        }

        // Validate and normalize test cases
        const now = new Date().toISOString();
        const normalized = testCases.map((tc: Record<string, unknown>, i: number) => ({
            id: tc.id || `import-${Date.now()}-${i}`,
            tcId: tc.tcId || `TC-IMPORT-${String(i + 1).padStart(3, '0')}`,
            title: tc.title || 'Untitled',
            description: tc.description || '',
            module: tc.module || '',
            folderId: tc.folderId || '',
            priority: ['Critical', 'High', 'Medium', 'Low'].includes(tc.priority as string) ? (tc.priority as string) : 'Medium',
            status: ['Pass', 'Fail', 'Blocked', 'Skipped', 'Not Run'].includes(tc.status as string) ? (tc.status as string) : 'Not Run',
            preconditions: tc.preconditions || '',
            steps: Array.isArray(tc.steps) ? tc.steps.map((s: Record<string, unknown>, si: number) => ({
                id: `step-${Date.now()}-${i}-${si}`,
                stepNumber: si + 1,
                action: s.action || '',
                expectedResult: s.expectedResult || '',
            })) : [],
            tags: Array.isArray(tc.tags) ? tc.tags : [],
            createdBy: 'Import',
            createdAt: now,
            updatedAt: now,
            automationStatus: 'Manual',
        }));

        return NextResponse.json({ success: true, count: normalized.length, testCases: normalized });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Import failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function parseCSV(text: string): Record<string, unknown>[] {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const results: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

        results.push({
            title: row.title || row.name || row['test case'] || '',
            description: row.description || row.desc || '',
            priority: row.priority || 'Medium',
            preconditions: row.preconditions || row.precondition || '',
            steps: row.steps ? row.steps.split(';').map((s: string) => ({ action: s.trim(), expectedResult: '' })) : [],
            tags: row.tags ? row.tags.split(';').map((t: string) => t.trim()) : [],
        });
    }

    return results;
}
