export interface MasterDataActionResult<T> {
  success: boolean
  data?: T
  error?: string
}
