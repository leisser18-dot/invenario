// Cloudflare Worker - Inventario Fibex
// Sirve la app estatica (ASSETS) y gestiona los usuarios en KV.
// Solo acepta peticiones cuyo Origin sea este mismo dominio.

const ORIGEN_PERMITIDO = 'https://invenario.leisser-18.workers.dev';

const USUARIOS_INICIALES = [
    { email: 'lcsanchez@fibextelecom.net', pass: 'Chachi1511*-', nombre: 'Luis Sanchez', rol: 'ADMIN', estado: 'ACTIVO' },
    { email: 'acalderon@fibextelecom.net', pass: null, nombre: 'Andres Calderon', rol: 'USUARIO', estado: 'ACTIVO' },
    { email: 'fnavarro@fibextelecom.net', pass: null, nombre: 'Francisco Navarro', rol: 'USUARIO', estado: 'ACTIVO' },
    { email: 'paalvarado@fibextelecom.net', pass: null, nombre: 'Paola Alvarado', rol: 'ADMIN', estado: 'ACTIVO' },
    { email: 'aespinal@fibextelecom.net', pass: null, nombre: 'Andres Espinal', rol: 'USUARIO', estado: 'ACTIVO' },
    { email: 'jmoncada@fibextelecom.net', pass: null, nombre: 'Jhair Moncada', rol: 'USUARIO', estado: 'ACTIVO' },
    { email: 'eperez@fibextelecom.net', pass: null, nombre: 'Elena Perez', rol: 'USUARIO', estado: 'ACTIVO' },
    { email: 'carangel@fibextelecom.net', pass: null, nombre: 'Carlos Angel', rol: 'USUARIO', estado: 'ACTIVO' },
    { email: 'aldiaz@fibextelecom.net', pass: null, nombre: 'Andres Diaz', rol: 'USUARIO', estado: 'ACTIVO' }
];

async function hash(pw) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function leerUsuarios(env) {
    const raw = await env.USUARIOS.get('usuarios', 'json');
    const users = (raw && Array.isArray(raw)) ? raw : [];
    let changed = users.length === 0;
    for (const init of USUARIOS_INICIALES) {
        const existing = users.find(x => x.email === init.email);
        if (!existing) {
            users.push({ email: init.email, pass: init.pass ? await hash(init.pass) : null, nombre: init.nombre, rol: init.rol, estado: init.estado });
            changed = true;
        } else if (!existing.nombre || !existing.rol || !existing.estado) {
            if (!existing.nombre) existing.nombre = init.nombre;
            if (!existing.rol) existing.rol = init.rol;
            if (!existing.estado) existing.estado = init.estado;
            changed = true;
        }
    }
    if (changed) await env.USUARIOS.put('usuarios', JSON.stringify(users));
    return users;
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function leerBody(req) {
    try { return await req.json(); } catch (e) { return {}; }
}

function esOrigenPermitido(req) {
    const origin = req.headers.get('Origin') || '';
    return origin === ORIGEN_PERMITIDO;
}

async function verificar(users, env, body) {
    const email = (body.email || '').toString().trim().toLowerCase();
    const password = (body.password || '').toString();
    if (!email || !password) return { ok: false, error: 'Ingrese correo y contrasena' };
    const u = users.find(x => x.email === email);
    if (!u) return { ok: false, error: 'Usuario no encontrado' };
    if (u.estado === 'INACTIVO') return { ok: false, error: 'Su cuenta ha sido desactivada. Contacte al administrador.' };
    if (!u.pass) {
        u.pass = await hash(password);
        await env.USUARIOS.put('usuarios', JSON.stringify(users));
        return { ok: true };
    }
    if (u.pass === await hash(password)) return { ok: true };
    return { ok: false, error: 'Correo o contrasena incorrectos' };
}

async function cambiar(users, env, body) {
    const email = (body.email || '').toString().trim().toLowerCase();
    const actual = (body.actual || '').toString();
    const nueva = (body.nueva || '').toString();
    if (!email || !actual || !nueva) return { ok: false, error: 'Datos incompletos' };
    const u = users.find(x => x.email === email);
    if (!u) return { ok: false, error: 'Usuario no encontrado' };
    if (u.pass && u.pass !== await hash(actual)) return { ok: false, error: 'La contrasena actual es incorrecta' };
    if (nueva.length < 6) return { ok: false, error: 'La nueva contrasena debe tener al menos 6 caracteres' };
    u.pass = await hash(nueva);
    await env.USUARIOS.put('usuarios', JSON.stringify(users));
    return { ok: true };
}

function listar(users) {
    const safe = users.map(u => ({ email: u.email, nombre: u.nombre || '', rol: u.rol || 'USUARIO', estado: u.estado || 'ACTIVO' }));
    return { ok: true, usuarios: safe };
}

async function agregar(users, env, body) {
    const email = (body.email || '').toString().trim().toLowerCase();
    const nombre = (body.nombre || '').toString().trim();
    const pass = (body.password || '').toString();
    const rol = (body.rol || 'USUARIO').toString().toUpperCase();
    if (!email || !nombre) return { ok: false, error: 'Nombre y correo son obligatorios' };
    if (users.some(x => x.email === email)) return { ok: false, error: 'Ya existe un usuario con ese correo' };
    if (!pass) return { ok: false, error: 'La contraseña es obligatoria' };
    users.push({ email, pass: await hash(pass), nombre, rol, estado: 'ACTIVO' });
    await env.USUARIOS.put('usuarios', JSON.stringify(users));
    return { ok: true };
}

async function toggleEstado(users, env, body) {
    const email = (body.email || '').toString().trim().toLowerCase();
    if (!email) return { ok: false, error: 'Correo requerido' };
    const u = users.find(x => x.email === email);
    if (!u) return { ok: false, error: 'Usuario no encontrado' };
    u.estado = (u.estado === 'ACTIVO') ? 'INACTIVO' : 'ACTIVO';
    await env.USUARIOS.put('usuarios', JSON.stringify(users));
    return { ok: true, estado: u.estado };
}

async function eliminar(users, env, body) {
    const email = (body.email || '').toString().trim().toLowerCase();
    if (!email) return { ok: false, error: 'Correo requerido' };
    const adminEmails = USUARIOS_INICIALES.filter(u => u.rol === 'ADMIN').map(u => u.email);
    if (adminEmails.includes(email)) return { ok: false, error: 'No se puede eliminar un administrador principal' };
    const idx = users.findIndex(x => x.email === email);
    if (idx < 0) return { ok: false, error: 'Usuario no encontrado' };
    users.splice(idx, 1);
    await env.USUARIOS.put('usuarios', JSON.stringify(users));
    return { ok: true };
}

async function editar(users, env, body) {
    const email = (body.email || '').toString().trim().toLowerCase();
    const nombre = (body.nombre || '').toString().trim();
    const rol = (body.rol || '').toString().toUpperCase();
    const nueva = (body.password || '').toString();
    if (!email) return { ok: false, error: 'Correo requerido' };
    const u = users.find(x => x.email === email);
    if (!u) return { ok: false, error: 'Usuario no encontrado' };
    if (nombre) u.nombre = nombre;
    if (rol) u.rol = rol;
    if (nueva && nueva.length >= 6) u.pass = await hash(nueva);
    await env.USUARIOS.put('usuarios', JSON.stringify(users));
    return { ok: true };
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname.startsWith('/api/usuarios/')) {
            if (!esOrigenPermitido(request)) return json({ ok: false, error: 'Origen no permitido' }, 403);
            const body = await leerBody(request);
            const accion = url.pathname.slice('/api/usuarios/'.length);
            const users = await leerUsuarios(env);
            if (accion === 'verificar') return json(await verificar(users, env, body));
            if (accion === 'cambiar') return json(await cambiar(users, env, body));
            if (accion === 'listar') return json(listar(users));
            if (accion === 'agregar') return json(await agregar(users, env, body));
            if (accion === 'toggle') return json(await toggleEstado(users, env, body));
            if (accion === 'eliminar') return json(await eliminar(users, env, body));
            if (accion === 'editar') return json(await editar(users, env, body));
            return json({ ok: false, error: 'Accion desconocida' });
        }

        return env.ASSETS.fetch(request);
    }
};
