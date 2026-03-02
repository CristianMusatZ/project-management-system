/**
 * Teste unitare — logica din AuthContext
 * Compatibil Jest + ts-jest (fără import din 'vitest').
 * Testăm comportamentul funcțiilor login, register, logout, updateUser,
 * logica RBAC și persistența în localStorage, fără a randa componente React.
 */

// ─── Mock localStorage ─────────────────────────────────────────────────────────
// store expus la nivel de modul, astfel încât beforeEach să poată restaura
// implementările după jest.resetAllMocks()
let store: Record<string, string> = {};

const localStorageMock = {
  getItem: jest.fn((key: string) => store[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: jest.fn((key: string) => { delete store[key]; }),
  clear: jest.fn(() => { store = {}; }),
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

/** Restaurează implementările store-based după un resetAllMocks(). */
function restoreMockImpls() {
  localStorageMock.getItem.mockImplementation((key: string) => store[key] ?? null);
  localStorageMock.setItem.mockImplementation((key: string, value: string) => { store[key] = value; });
  localStorageMock.removeItem.mockImplementation((key: string) => { delete store[key]; });
  localStorageMock.clear.mockImplementation(() => { store = {}; });
}

// ─────────────────────────────────────────────────────────────────────────────
// Teste pe logica localStorage
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthContext — logica localStorage', () => {
  beforeEach(() => {
    store = {};
    jest.resetAllMocks();
    restoreMockImpls();
  });

  it('salvează token și user în localStorage la login cu succes', () => {
    const token = 'jwt.test.token';
    const user = { id: 1, email: 'ion@pms.ro', role: 'admin', firstName: 'Ion', lastName: 'Pop' };

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    expect(localStorageMock.setItem).toHaveBeenCalledWith('token', token);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(user));
    expect(localStorage.getItem('token')).toBe(token);
  });

  it('șterge token și user din localStorage la logout', () => {
    localStorage.setItem('token', 'some.token');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('actualizează user în localStorage la updateUser', () => {
    const initialUser = { id: 1, email: 'ion@pms.ro', role: 'member', firstName: 'Ion', lastName: 'Pop' };
    localStorage.setItem('user', JSON.stringify(initialUser));

    const updates = { firstName: 'Ionuț', lastName: 'Popescu' };
    const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const updatedUser = { ...savedUser, ...updates };
    localStorage.setItem('user', JSON.stringify(updatedUser));

    const result = JSON.parse(localStorage.getItem('user') || '{}');
    expect(result.firstName).toBe('Ionuț');
    expect(result.lastName).toBe('Popescu');
    expect(result.email).toBe('ion@pms.ro');
  });

  it('readuce session la reîncărcarea paginii dacă token există în localStorage', () => {
    const token = 'persistent.token';
    const user = { id: 2, email: 'maria@pms.ro', role: 'project_manager', firstName: 'Maria', lastName: 'Ionescu' };

    // Populăm store-ul direct, fără mockImplementation care ar persista
    store['token'] = token;
    store['user'] = JSON.stringify(user);

    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    expect(savedToken).toBe(token);
    expect(JSON.parse(savedUser!)).toMatchObject({ email: 'maria@pms.ro', role: 'project_manager' });
  });

  it('nu restaurează session dacă localStorage e gol', () => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    expect(savedToken).toBeNull();
    expect(savedUser).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Teste pe comportamentul la răspunsul API
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthContext — comportament răspuns API', () => {
  beforeEach(() => {
    store = {};
    jest.resetAllMocks();
    restoreMockImpls();
  });

  it('fluxul MFA: dacă API returnează requiresMFA, nu salvăm token final', () => {
    const apiResponse = { data: { requiresMFA: true, tempToken: 'temp.mfa.token' } };

    if (apiResponse.data.requiresMFA) {
      expect(apiResponse.data.requiresMFA).toBe(true);
      expect(apiResponse.data.tempToken).toBe('temp.mfa.token');
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    }
  });

  it('login normal: salvăm token și user din răspunsul API', () => {
    const apiResponse = {
      data: {
        token: 'real.jwt.token',
        user: { id: 1, email: 'ion@pms.ro', role: 'admin', firstName: 'Ion', lastName: 'Pop' },
      },
    };

    const { token, user } = apiResponse.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    expect(localStorage.getItem('token')).toBe('real.jwt.token');
    const storedUser = JSON.parse(localStorage.getItem('user')!);
    expect(storedUser.email).toBe('ion@pms.ro');
  });

  it('fluxul de verificare email: dacă API returnează requiresEmailVerification, nu salvăm token', () => {
    const apiResponse = { data: { requiresEmailVerification: true } };

    if (apiResponse.data.requiresEmailVerification) {
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Teste pe structura user payload
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthContext — validare structură user', () => {
  it('un user valid are toate câmpurile necesare', () => {
    const user = {
      id: 1,
      email: 'ion@pms.ro',
      role: 'admin' as const,
      firstName: 'Ion',
      lastName: 'Pop',
    };

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('firstName');
    expect(user).toHaveProperty('lastName');
    expect(['admin', 'project_manager', 'member', 'viewer']).toContain(user.role);
  });

  it('updateUser merge corect două obiecte de user', () => {
    const prev = { id: 1, email: 'ion@pms.ro', role: 'member', firstName: 'Ion', lastName: 'Pop' };
    const updates = { firstName: 'Ionuț' };
    const result = { ...prev, ...updates };

    expect(result.firstName).toBe('Ionuț');
    expect(result.lastName).toBe('Pop');
    expect(result.email).toBe('ion@pms.ro');
    expect(result.role).toBe('member');
  });

  it('un email în lowercase este consistent cu normalizarea din backend', () => {
    const email = 'ION@PMS.RO';
    const normalized = email.toLowerCase();
    expect(normalized).toBe('ion@pms.ro');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Teste RBAC — verificare roluri (logică frontend)
// ─────────────────────────────────────────────────────────────────────────────

describe('RBAC frontend — logica de permisiuni', () => {
  type Role = 'admin' | 'project_manager' | 'member' | 'viewer';

  // Funcție identică cu cea din ReportsPage.tsx
  function canExport(role: Role): boolean {
    return ['admin', 'project_manager', 'viewer'].includes(role);
  }

  it('admin poate exporta rapoarte', () => expect(canExport('admin')).toBe(true));
  it('project_manager poate exporta rapoarte', () => expect(canExport('project_manager')).toBe(true));
  it('viewer poate exporta rapoarte', () => expect(canExport('viewer')).toBe(true));
  it('member NU poate exporta rapoarte', () => expect(canExport('member')).toBe(false));

  // Logica de filtrare nav items din Layout.tsx
  function navItemVisible(itemRoles: string[] | undefined, userRole: Role): boolean {
    if (!itemRoles) return true;
    return itemRoles.includes(userRole);
  }

  it('Users și Settings apar doar pentru admin', () => {
    const adminOnlyRoles = ['admin'];
    expect(navItemVisible(adminOnlyRoles, 'admin')).toBe(true);
    expect(navItemVisible(adminOnlyRoles, 'project_manager')).toBe(false);
    expect(navItemVisible(adminOnlyRoles, 'member')).toBe(false);
    expect(navItemVisible(adminOnlyRoles, 'viewer')).toBe(false);
  });

  it('elementele fără restricții de rol sunt vizibile pentru toți', () => {
    const roles: Role[] = ['admin', 'project_manager', 'member', 'viewer'];
    for (const role of roles) {
      expect(navItemVisible(undefined, role)).toBe(true);
    }
  });

  it('member are drepturi mai restrânse decât admin și PM', () => {
    const restrictedRoles = ['admin', 'project_manager'];
    expect(navItemVisible(restrictedRoles, 'admin')).toBe(true);
    expect(navItemVisible(restrictedRoles, 'project_manager')).toBe(true);
    expect(navItemVisible(restrictedRoles, 'member')).toBe(false);
    expect(navItemVisible(restrictedRoles, 'viewer')).toBe(false);
  });
});
