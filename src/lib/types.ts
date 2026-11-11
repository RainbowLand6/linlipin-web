export type ID = string
export interface Me {
  id: ID
  phone: string
  display_name: string
  community_id: ID
  platform_admin: boolean
  must_change_password: boolean
  avatar_url: string | null
  membership_version?: number
}
export interface ProductInput {
  name: string
  remark?: string
  purchase_price_cent: number
  capacity: number
  min_quantity: number
  price_mode: 'AUTO' | 'MANUAL'
  unit_price_cent?: number
  image_id?: ID
}
export interface PublishProductInput {
  version: number
  allow_duplicate: boolean
}
export interface Product extends ProductInput {
  id: ID
  version: number
  image_url: string | null
  unit_price_cent: number
}
export interface PoolItem {
  id: ID
  product_id: ID
  item_no: number
  name: string
  remark?: string
  created_at?: string
  owner_id: ID
  owner_name: string
  capacity: number
  min_quantity: number
  unit_price_cent: number
  purchase_price_cent: number | null
  price_mode: 'AUTO' | 'MANUAL'
  image_id?: ID
  image_url: string | null
  enabled: boolean
  ever_ordered: boolean
  status: 'POOL' | 'CLAIMED' | 'CANCELLED'
  reserved_quantity: number
  remaining_quantity: number
  version: number
  selection_token?: string
  group_id: ID | null
}
export interface PoolDetail extends PoolItem {
  own_quantity: number
  can_edit_subscription: boolean
  subscription_version: number
  participant_count: number
}
export interface Participation {
  pool_item_id: ID
  state: 'POOL' | 'CLAIMED' | 'CANCELLED'
  participants: { member_name: string; quantity: number; cancelled: boolean }[]
}
export interface CommunityShare {
  community_name: string
  community_url: string
}
export interface SubscriptionLine {
  pool_item_id: ID
  quantity: number
  name: string
  unit_price_cent: number
}
export interface SubscriptionSet {
  version: number
  display_name: string
  lines: SubscriptionLine[]
  history: { created_at: string; description: string }[]
}
export interface OrderLine {
  id: ID
  item_no: number
  pool_item_id: ID
  name: string
  quantity: number
  unit_price_cent: number
  original_amount_cent: number
  image_url: string | null
  cancelled: boolean
  reason: string | null
}
export interface Order {
  id: ID
  user_id: ID
  pickup_no: string
  member_name: string
  original_amount_cent: number
  payable_amount_cent: number
  paid_amount_cent: number
  refunded_amount_cent: number
  refund_due_cent: number
  status: 'WAIT_PAYMENT' | 'WAIT_PICKUP' | 'WAIT_REFUND' | 'COMPLETED' | 'NO_DEAL'
  picked_up_at: string | null
  version: number
  lines: OrderLine[]
}
export interface MyOrder extends Order {
  group_id: ID
  group_title: string
  location: string
  pickup_at: string
  organizer_name: string
}
export interface GroupSummary {
  id: ID
  title: string
  status: 'FULFILLING' | 'ENDED'
  location: string
  pickup_at: string
  organizer_name: string
  order_count: number
  total_amount_cent: number
  version: number
}
export interface Group extends GroupSummary {
  notice: string
  organizer_id: ID
  items: PoolItem[]
  orders: Order[]
}
export interface Preview {
  items: PoolItem[]
  versions: Record<ID, number>
  order_count: number
  total_amount_cent: number
}
export interface PublicGroup {
  title: string
  group_title?: string
  organizer_name: string
  location: string
  pickup_at: string
  status: string
  notice?: string
  items: { item_no: number; name: string; unit_price_cent?: number; image_url: string | null }[]
}
export interface Share extends PublicGroup {
  community_url: string
  group_url: string
}
export interface PublicCommunity {
  id: ID
  name?: string
  title?: string
}
export interface Media {
  id: ID
  url: string
  width: number
  height: number
}
