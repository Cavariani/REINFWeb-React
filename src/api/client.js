const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

function getToken() {
  return localStorage.getItem('reinf_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (getToken()) {
      // Token expirado — força logout
      localStorage.removeItem('reinf_token');
      localStorage.removeItem('reinf_user');
      window.dispatchEvent(new Event('reinf:logout'));
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    throw new Error('Credenciais inválidas.');
  }

  if (!res.ok) {
    let message = `Erro ${res.status}: não foi possível processar a requisição.`;
    try {
      const data = await res.json();
      const raw = data.message ?? data.title;
      if (raw && !/one or more validation/i.test(raw)) {
        message = raw;
      } else if (raw) {
        message = 'Dados inválidos no envio. Verifique o preenchimento e tente novamente.';
      }
    } catch {
      message = await res.text().catch(() => message);
    }
    throw new Error(message);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email, senha) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
  localStorage.setItem('reinf_token', data.token);
  localStorage.setItem('reinf_user', JSON.stringify({
    id: data.id, nome: data.nome, email: data.email,
    isAdmin: data.isAdmin, isSuperAdmin: data.isSuperAdmin, clienteId: data.clienteId,
  }));
  return data;
}

export function logout() {
  localStorage.removeItem('reinf_token');
  localStorage.removeItem('reinf_user');
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('reinf_user'));
  } catch {
    return null;
  }
}

// ── Certificados ──────────────────────────────────────────────────────────────

export async function listCertificados() {
  return request('/api/certificates');
}

export async function uploadCertificado(nome, cnpj, senha, file) {
  const form = new FormData();
  form.append('nome', nome);
  form.append('cnpjContribuinte', cnpj);
  form.append('senha', senha);
  form.append('arquivo', file);
  return request('/api/certificates', { method: 'POST', body: form });
}

export async function deleteCertificado(id) {
  return request(`/api/certificates/${id}`, { method: 'DELETE' });
}

// ── Envios ────────────────────────────────────────────────────────────────────

export async function enviar(payload) {
  return request('/api/envios', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function validar(payload) {
  return request('/api/envios/validar', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Lotes ─────────────────────────────────────────────────────────────────────

export async function listLotes(page = 1, pageSize = 20) {
  return request(`/api/lotes?page=${page}&pageSize=${pageSize}`);
}

export async function getLote(id) {
  return request(`/api/lotes/${id}`);
}

export async function exportarLotes() {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/lotes/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Erro ao exportar: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reinf-export-${new Date().toISOString().slice(0,10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Empresas ──────────────────────────────────────────────────────────────────

export async function listEmpresas() {
  return request('/api/empresas');
}

export async function criarEmpresa(nome, cnpj, isEmissora = false) {
  return request('/api/empresas', {
    method: 'POST',
    body: JSON.stringify({ nome, cnpj, isEmissora }),
  });
}

export async function deletarEmpresa(id) {
  return request(`/api/empresas/${id}`, { method: 'DELETE' });
}

export async function associarUsuarioEmpresa(empresaId, usuarioId) {
  return request(`/api/empresas/${empresaId}/usuarios`, {
    method: 'POST',
    body: JSON.stringify({ usuarioId }),
  });
}

export async function desassociarUsuarioEmpresa(empresaId, usuarioId) {
  return request(`/api/empresas/${empresaId}/usuarios/${usuarioId}`, { method: 'DELETE' });
}

export async function setCertificadoEmpresa(empresaId, certificadoId) {
  return request(`/api/empresas/${empresaId}/certificado`, {
    method: 'PUT',
    body: JSON.stringify({ certificadoId: certificadoId ?? null }),
  });
}

// ── Resumo ────────────────────────────────────────────────────────────────────

export async function getResumo(inicio, fim, cnpj = '', ambiente = '') {
  const params = new URLSearchParams({ inicio, fim });
  if (cnpj)     params.append('cnpj', cnpj);
  if (ambiente) params.append('ambiente', ambiente);
  return request(`/api/resumo?${params}`);
}

// ── Consulta ──────────────────────────────────────────────────────────────────

export async function consultarLote(protocolo, certId, ambiente, tpEnvio = '', skipCreate = false) {
  const params = new URLSearchParams({ protocolo, certId: String(certId), ambiente })
  if (tpEnvio) params.append('tpEnvio', tpEnvio)
  if (skipCreate) params.append('skipCreate', 'true')
  return request(`/api/consulta?${params}`)
}

export async function finalizarLote(payload) {
  return request('/api/lotes/finalizar', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function consultarContribuinte(cnpj, certId, ambiente = 'homologacao') {
  const params = new URLSearchParams({ cnpj, certId: String(certId), ambiente });
  return request(`/api/consulta/contribuinte?${params}`);
}

// ── Usuários (admin) ──────────────────────────────────────────────────────────

export async function listUsuarios() {
  return request('/api/users');
}

export async function criarUsuario(nome, email, senha, isAdmin = false) {
  return request('/api/users', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha, isAdmin }),
  });
}

export async function deletarUsuario(id) {
  return request(`/api/users/${id}`, { method: 'DELETE' });
}

export async function alterarSenhaUsuario(id, novaSenha) {
  return request(`/api/users/${id}/senha`, {
    method: 'PUT',
    body: JSON.stringify({ novaSenha }),
  });
}

export async function atualizarUsuario(id, nome, email) {
  return request(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ nome, email }),
  });
}

// ── Clientes (SuperAdmin) ─────────────────────────────────────────────────────

export async function listClientes() {
  return request('/api/clientes');
}

export async function criarCliente(nome) {
  return request('/api/clientes', { method: 'POST', body: JSON.stringify({ nome }) });
}

export async function updateCliente(id, nome, ativa) {
  return request(`/api/clientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ nome, ativa }),
  });
}

export async function criarClienteAdmin(clienteId, nome, email, senha) {
  return request(`/api/clientes/${clienteId}/admin`, {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha }),
  });
}

export async function deletarCliente(id) {
  return request(`/api/clientes/${id}`, { method: 'DELETE' });
}

export async function listClienteUsuarios(clienteId) {
  return request(`/api/clientes/${clienteId}/usuarios`);
}

// ── Informe de Rendimentos ────────────────────────────────────────────────────

export async function getInforme(cnpjContrib, ano) {
  const params = new URLSearchParams({ cnpjContrib, ano });
  return request(`/api/informe?${params}`);
}
