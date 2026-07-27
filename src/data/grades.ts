// Grade Master Catalog. Positions inherit a grade from this list — HR never
// picks a grade by hand for an individual employee (see positions.ts).

export interface Grade {
  id: string
  name: string
}

export const grades: Grade[] = [
  { id: "g1", name: "G1" },
  { id: "g2", name: "G2" },
  { id: "g3", name: "G3" },
  { id: "g4", name: "G4" },
  { id: "g5", name: "G5" },
  { id: "g6", name: "G6" },
  { id: "g7", name: "G7" },
]
