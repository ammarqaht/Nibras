import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllSupervisors, getSettings, DEFAULT_ROLE_PERMISSIONS } from '@/lib/services';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Fetch latest user details and permissions
    const supervisors = await getAllSupervisors();
    const currentUser = supervisors.find(s => s.id === session.id);
    if (!currentUser) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Force admin role for the owner emails
    const adminEmails = ['admin', 'admin@nibras.com', 'mohammed.qahtani', 'mohammed.yabis', '2000', '2001', '2005'];
    if (adminEmails.includes(currentUser.email.toLowerCase().trim())) {
      currentUser.role = 'admin';
    }

    // Role permissions from settings
    const settings = await getSettings();
    let rolePermissionsMap: Record<string, string[]> = DEFAULT_ROLE_PERMISSIONS;
    try {
      if (settings.role_permissions) {
        rolePermissionsMap = JSON.parse(settings.role_permissions);
      }
    } catch {}

    const isGlobalAdmin = currentUser.role === 'admin';
    
    // Base permissions from roles
    const rolesList = currentUser.role.split(',').map(r => r.trim()).filter(Boolean);
    const basePerms = new Set<string>();
    
    for (const r of rolesList) {
      const perms = rolePermissionsMap[r];
      if (perms) {
        perms.forEach(p => basePerms.add(p));
      }
    }

    // Merge custom permissions
    if (currentUser.customPermissions) {
      const customParts = currentUser.customPermissions.split(',').map(p => p.trim()).filter(Boolean);
      customParts.forEach(p => {
        if (p.startsWith('-')) {
          basePerms.delete(p.substring(1)); // Allow revoking a permission
        } else {
          basePerms.add(p);
        }
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        groupIds: currentUser.groupIds ?? '',
        stage: currentUser.stage ?? '',
        permissions: isGlobalAdmin ? ['*'] : Array.from(basePerms)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
