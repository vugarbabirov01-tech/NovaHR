import { getEmployeeById, updateEmployeeProfile } from "@/data/employee-directory"
import type { AssetAssignment, AssetProvider, AssetReturnUpdate } from "@/types/integrations/asset-management"

/**
 * Temporary adapter — Asset Management doesn't exist as its own module yet,
 * so this reads/writes the same mock employeeDirectory everything else in
 * this demo uses. It is the ONLY file that does so for asset data. When a
 * real Asset Management module ships, only this file gets replaced; nothing
 * in Termination (or any other consumer of AssetProvider) changes.
 */
class MockAssetManagementProvider implements AssetProvider {
  async getAssignedAssets(employeeId: string): Promise<AssetAssignment[]> {
    const profile = getEmployeeById(employeeId)
    if (!profile) return []
    return profile.assets.map((asset) => ({
      id: asset.id,
      category: asset.category,
      name: asset.name,
      assetTag: asset.assetTag,
      assignedDate: asset.assignedDate,
      status: asset.status,
    }))
  }

  async recordAssetReturns(employeeId: string, updates: AssetReturnUpdate[]): Promise<void> {
    const profile = getEmployeeById(employeeId)
    if (!profile || updates.length === 0) return

    const today = new Date().toISOString().slice(0, 10)
    const updatesById = new Map(updates.map((update) => [update.assetId, update.status]))

    updateEmployeeProfile(employeeId, {
      ...profile,
      assets: profile.assets.map((asset) => {
        const nextStatus = updatesById.get(asset.id)
        if (!nextStatus) return asset
        return {
          ...asset,
          status: nextStatus,
          returnedDate: nextStatus === "returned" ? today : asset.returnedDate,
        }
      }),
    })
  }
}

export const assetProvider: AssetProvider = new MockAssetManagementProvider()
