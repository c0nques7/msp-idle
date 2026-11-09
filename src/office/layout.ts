// World layout for the office, in meters. x runs left to right across the
// back wall, z runs from the back wall toward the camera.

export const FLOOR_W = 18
export const FLOOR_D = 12

export interface Area {
  key: string
  label: string
  x0: number
  x1: number
  z0: number
  z1: number
}

export const AREAS: Record<string, Area> = {
  pod: { key: 'pod', label: 'HELPDESK POD', x0: 0.3, x1: 8.2, z0: 0.3, z1: 5.7 },
  desk: { key: 'desk', label: 'YOUR DESK', x0: 8.5, x1: 12.1, z0: 0.3, z1: 5.7 },
  closet: { key: 'closet', label: 'SERVER CLOSET', x0: 12.4, x1: 17.7, z0: 0.3, z1: 5.7 },
  entrance: { key: 'entrance', label: 'ENTRANCE', x0: 0.3, x1: 4.2, z0: 6, z1: 11.7 },
  printer: { key: 'printer', label: 'PRINTER CORNER', x0: 4.5, x1: 8.2, z0: 6, z1: 11.7 },
  breakRoom: { key: 'breakRoom', label: 'BREAK ROOM', x0: 8.5, x1: 12.1, z0: 6, z1: 11.7 },
  expansion: { key: 'expansion', label: 'EXPANSION', x0: 12.4, x1: 17.7, z0: 6, z1: 11.7 },
}

/** Desk slots in the pod: 4 columns by 3 rows. */
export const DESK_POSITIONS: [number, number][] = []
for (const z of [1.3, 3.0, 4.7]) for (const x of [1.3, 3.2, 5.1, 7.0]) DESK_POSITIONS.push([x, z])

export const YOUR_DESK: [number, number] = [10.3, 2.6]
export const PRINTER: [number, number] = [6.4, 8.4]
export const AP: [number, number, number] = [4.1, 2.9, 3.0]
export const RACK: [number, number] = [16.2, 1.3]
export const NAS: [number, number] = [14.5, 1.3]
