// The contract Termination (and later Transfers, Promotions, Department
// Changes, Temporary Assignments) consume assets through. None of them own
// asset data or return logic — that belongs entirely to Asset Management.

import type { AssetCategory, AssetStatus } from "@/types/employee-profile"

export interface AssetAssignment {
  id: string
  category: AssetCategory
  name: string
  assetTag: string
  assignedDate: string
  status: AssetStatus
}

export interface AssetReturnUpdate {
  assetId: string
  status: AssetStatus
}

export interface AssetProvider {
  getAssignedAssets(employeeId: string): Promise<AssetAssignment[]>
  recordAssetReturns(employeeId: string, updates: AssetReturnUpdate[]): Promise<void>
}
