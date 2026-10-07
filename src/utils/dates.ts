/**
 * Funções puras para manipulação segura de datas no fuso horário local
 * Evita bugs de conversão UTC (ex: '2026-10-07' virando dia anterior)
 */

/**
 * Retorna a data de hoje no formato 'YYYY-MM-DD' de acordo com o fuso horário local do usuário
 */
export function getHojeIso(): string {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Retorna o último dia de um determinado ano e mês (mesBase 1-12)
 */
export function getUltimoDiaDoMes(ano: number, mesBase1: number): number {
  // Passar dia 0 para o mês seguinte retorna o último dia do mês desejado
  return new Date(ano, mesBase1, 0).getDate();
}

/**
 * Formata data ISO 'YYYY-MM-DD' para o padrão brasileiro 'DD/MM/AAAA'
 */
export function formatarDataBr(dataIso: string): string {
  if (!dataIso) return '';
  const partes = dataIso.split('-');
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Extrai o dia, mês e ano como inteiros de uma string ISO 'YYYY-MM-DD'
 */
export function extrairPartesData(dataIso: string): { ano: number; mes: number; dia: number } {
  const partes = dataIso.split('-').map(Number);
  return {
    ano: partes[0] || 2026,
    mes: partes[1] || 1,
    dia: partes[2] || 1,
  };
}

/**
 * Deriva o status em tempo de execução:
 * - Se estiver pago, permanece 'pago'
 * - Se pendente e data_vencimento < hoje, deriva como 'atrasado'
 * - Se pendente e data_vencimento >= hoje, deriva como 'pendente'
 */
export function derivarStatus(
  statusGravado: 'pendente' | 'pago' | string,
  dataVencimento: string,
  hojeIso?: string
): 'pendente' | 'pago' | 'atrasado' {
  if (statusGravado === 'pago') {
    return 'pago';
  }
  const hoje = hojeIso || getHojeIso();
  if (dataVencimento < hoje) {
    return 'atrasado';
  }
  return 'pendente';
}

/**
 * Calcula a próxima data de vencimento com respeito estrito a fim de mês.
 * Exemplo: Uma conta recorrente no dia 31:
 * - Jan 31 -> Fev 28 (ou 29 em bissexto) -> Mar 31 -> Abr 30 -> Mai 31.
 * O parâmetro `diaBaseOriginal` preserva o dia pretendido quando meses mais curtos são ultrapassados.
 */
export function calcularProximoVencimento(
  dataAtualIso: string,
  frequencia: 'semanal' | 'quinzenal' | 'mensal' | 'semestral' | 'anual',
  diaBaseOriginal?: number
): string {
  const { ano, mes, dia } = extrairPartesData(dataAtualIso);
  const diaAlvo = diaBaseOriginal || dia;

  if (frequencia === 'semanal') {
    // +7 dias
    const d = new Date(ano, mes - 1, dia + 7);
    const a = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${a}-${m}-${day}`;
  }

  if (frequencia === 'quinzenal') {
    // +14 dias
    const d = new Date(ano, mes - 1, dia + 14);
    const a = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${a}-${m}-${day}`;
  }

  let mesesAvanco = 1;
  if (frequencia === 'semestral') mesesAvanco = 6;
  if (frequencia === 'anual') mesesAvanco = 12;

  // Calcula novo ano e mês
  const mesTotal = mes - 1 + mesesAvanco;
  const novoAno = ano + Math.floor(mesTotal / 12);
  const novoMes = (mesTotal % 12) + 1;

  // Ajusta o dia para não estourar o fim do mês
  const ultimoDia = getUltimoDiaDoMes(novoAno, novoMes);
  const diaFinal = Math.min(diaAlvo, ultimoDia);

  const mStr = String(novoMes).padStart(2, '0');
  const dStr = String(diaFinal).padStart(2, '0');
  return `${novoAno}-${mStr}-${dStr}`;
}
