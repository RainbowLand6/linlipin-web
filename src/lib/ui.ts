export const money = (cent: number) => '¥' + (cent / 100).toFixed(2)
export const dateTime = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(iso))
    : '待安排'
export const statuses: Record<string, string> = {
  WAIT_PAYMENT: '待付款',
  WAIT_PICKUP: '待提货',
  WAIT_REFUND: '待退款',
  COMPLETED: '已完成',
  NO_DEAL: '已取消',
  POOL: '拼单中',
  CLAIMED: '已成团',
  CANCELLED: '已取消',
  FULFILLING: '履约中',
  ENDED: '已结束'
}
export function cents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('金额须为正数，最多两位小数。')
  const [whole, fraction = ''] = value.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('金额超出范围。')
  return result
}
export function passwordError(v: string, phone: string) {
  const kinds = [/[\p{L}]/u.test(v), /[\p{N}]/u.test(v), /[^\p{L}\p{N}]/u.test(v)].filter(Boolean).length
  if ([...v].length < 8 || [...v].length > 64 || kinds < 2 || v === phone)
    return '密码须为 8–64位，至少包含字母、数字、其他字符中的两类，不能与手机号相同'
  return ''
}
export { confirmation } from './dialog'
