// Cloudflare Worker - Inventario Fibex
// Sirve la app estatica (ASSETS) y gestiona los usuarios en KV.
// Solo acepta peticiones cuyo Origin sea este mismo dominio.

const ORIGEN_PERMITIDO = 'https://invenario.leisser-18.workers.dev';

const USUARIOS_INICIALES = [
    { email: 'lcsanchez@fibextelecom.net', pass: 'Chachi1511*-' },
    { email: 'acalderon@fibextelecom.net', pass: null },
    { email: 'fnavarro@fibextelecom.net', pass: null },
    { email: 'paalvarado@fibextelecom.net', pass: null }
];

async function hash(pw) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function leerUsuarios(env) {
    const raw = await env.USUARIOS.get('usuarios', 'json');
    if (raw && Array.isArray(raw) && raw.length) return raw;
    const base = [];
    for (const u of USUARIOS_INICIALES) {
        base.push({ email: u.email, pass: u.pass ? await hash(u.pass) : null });
    }
    await env.USUARIOS.put('usuarios', JSON.stringify(base));
    return base;
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
            return json({ ok: false, error: 'Accion desconocida' });
        }

        return env.ASSETS.fetch(request);
    }
};
