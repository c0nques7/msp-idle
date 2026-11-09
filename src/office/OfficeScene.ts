// Three.js renderer for the isometric office. The game engine owns all state;
// this class only draws it and reports clicks.
import * as THREE from 'three'
import type { GameState } from '../game/engine'
import { PROBLEMS } from '../game/officeContent'
import { AP, AREAS, DESK_POSITIONS, FLOOR_D, FLOOR_W, NAS, PRINTER, RACK, YOUR_DESK, type Area } from './layout'

export type Pick =
  | { kind: 'problem'; id: number }
  | { kind: 'crm' }
  | { kind: 'staff'; id: number }

export interface SceneCallbacks {
  onPick: (pick: Pick) => void
  onHover: (text: string | null, x: number, y: number) => void
  onIntroDone: () => void
}

interface Palette {
  floor: number
  wall: number
  areaFloor: Record<string, number>
  desk: number
  deskTop: number
  dark: number
  label: string
  outline: number
  screen: number
}

const LIGHT: Palette = {
  floor: 0xd9dde3,
  wall: 0xc4cad3,
  areaFloor: { pod: 0xe8ecf1, desk: 0xe3e9f5, closet: 0xdfe2e6, entrance: 0xe9e6df, printer: 0xe6e9ec, breakRoom: 0xebe5dc, expansion: 0xdfe2e6 },
  desk: 0x8c7a66,
  deskTop: 0xb59f86,
  dark: 0x2b3240,
  label: 'rgba(60,70,85,0.75)',
  outline: 0x8b95a3,
  screen: 0x5b8ff0,
}

const DARK: Palette = {
  floor: 0x1a212c,
  wall: 0x2a3341,
  areaFloor: { pod: 0x222b37, desk: 0x23304a, closet: 0x1f2630, entrance: 0x26262a, printer: 0x222830, breakRoom: 0x2a2621, expansion: 0x1f2630 },
  desk: 0x5b4c3e,
  deskTop: 0x7a6653,
  dark: 0x111720,
  label: 'rgba(200,210,225,0.6)',
  outline: 0x5d6878,
  screen: 0x6f9cf5,
}

const ROLE_COLORS: Record<string, number> = { tier1: 0x3d7be0, tier2: 0x2e9e5b, dispatcher: 0x8a5cd6, internalIt: 0xe08a2e }
const SKIN = [0xf1c7a3, 0xd9a47c, 0xa8724f, 0x7a4e33, 0xe8b894]

function isDark(): boolean {
  const theme = document.documentElement.getAttribute('data-theme')
  if (theme) return theme === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function box(w: number, h: number, d: number, color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function floorLabel(text: string, color: string, width: number): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.font = '600 34px system-ui, -apple-system, Segoe UI, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 8, 34)
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 8),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function dashedOutline(area: Area, color: number): THREE.LineSegments {
  const pts = [
    new THREE.Vector3(area.x0, 0.02, area.z0),
    new THREE.Vector3(area.x1, 0.02, area.z0),
    new THREE.Vector3(area.x1, 0.02, area.z1),
    new THREE.Vector3(area.x0, 0.02, area.z1),
  ]
  const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[1], pts[2], pts[2], pts[3], pts[3], pts[0]])
  const line = new THREE.LineSegments(geo, new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.2 }))
  line.computeLineDistances()
  return line
}

const VIEW_HEIGHT = 13
const CENTER = new THREE.Vector3(FLOOR_W / 2, 0, FLOOR_D / 2)

export class OfficeScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private dynamic = new THREE.Group()
  private markers: THREE.Object3D[] = []
  private people: { obj: THREE.Object3D; phase: number; working: boolean }[] = []
  private signature = ''
  private palette: Palette
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private frame = 0
  private clock = new THREE.Clock()
  private intro: { start: number; duration: number } | null = null
  private resizeObserver: ResizeObserver
  private lastState: GameState | null = null

  constructor(
    private container: HTMLElement,
    private callbacks: SceneCallbacks,
  ) {
    this.palette = isDark() ? DARK : LIGHT
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    // Classic isometric angle: 45 degrees around, about 35 degrees down.
    this.camera.position.set(CENTER.x + 20, 20 * Math.SQRT2 * Math.tan((35.264 * Math.PI) / 180), CENTER.z + 20)
    this.camera.lookAt(CENTER)

    this.buildStatic()
    this.scene.add(this.dynamic)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    const el = this.renderer.domElement
    el.addEventListener('click', this.onClick)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerleave', () => this.callbacks.onHover(null, 0, 0))
    this.loop()
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.renderer.domElement.removeEventListener('click', this.onClick)
    this.renderer.domElement.removeEventListener('pointermove', this.onMove)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  playIntro() {
    this.intro = { start: this.clock.getElapsedTime(), duration: 2.4 }
  }

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h)
    const aspect = w / h
    // Fit the whole floor: use the larger of height-fit and width-fit.
    const viewH = Math.max(VIEW_HEIGHT, (FLOOR_W * 1.25) / aspect)
    this.camera.left = (-viewH * aspect) / 2
    this.camera.right = (viewH * aspect) / 2
    this.camera.top = viewH / 2
    this.camera.bottom = -viewH / 2
    this.camera.updateProjectionMatrix()
  }

  private buildStatic() {
    const p = this.palette
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    sun.position.set(CENTER.x + 8, 18, CENTER.z + 12)
    sun.target.position.copy(CENTER)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    const sc = sun.shadow.camera
    sc.left = -14
    sc.right = 14
    sc.top = 14
    sc.bottom = -14
    this.scene.add(sun, sun.target)

    const floor = box(FLOOR_W, 0.2, FLOOR_D, p.floor)
    floor.position.set(FLOOR_W / 2, -0.1, FLOOR_D / 2)
    floor.castShadow = false
    this.scene.add(floor)

    // Back walls only, so the camera can see in.
    const wallA = box(FLOOR_W, 1.8, 0.15, p.wall)
    wallA.position.set(FLOOR_W / 2, 0.9, -0.075)
    const wallB = box(0.15, 1.8, FLOOR_D, p.wall)
    wallB.position.set(-0.075, 0.9, FLOOR_D / 2)
    this.scene.add(wallA, wallB)

    for (const area of Object.values(AREAS)) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(area.x1 - area.x0, area.z1 - area.z0),
        new THREE.MeshStandardMaterial({ color: p.areaFloor[area.key], roughness: 0.95 }),
      )
      tile.rotation.x = -Math.PI / 2
      tile.position.set((area.x0 + area.x1) / 2, 0.005, (area.z0 + area.z1) / 2)
      tile.receiveShadow = true
      this.scene.add(tile)
      const label = floorLabel(area.label, p.label, 3.2)
      label.position.set(area.x0 + 1.7, 0.012, area.z1 - 0.35)
      this.scene.add(label)
    }

    // Your desk with the CRM monitor.
    const yourDesk = new THREE.Group()
    const top = box(2.0, 0.08, 1.0, p.deskTop)
    top.position.y = 0.76
    const base = box(1.9, 0.72, 0.9, p.desk)
    base.position.y = 0.36
    const monitor = box(0.9, 0.55, 0.06, p.dark)
    monitor.position.set(0, 1.15, -0.3)
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.47),
      new THREE.MeshStandardMaterial({ color: p.screen, emissive: p.screen, emissiveIntensity: 0.9 }),
    )
    screen.position.set(0, 1.15, -0.265)
    const chair = box(0.5, 0.5, 0.5, 0x3a4252)
    chair.position.set(0, 0.25, 0.75)
    yourDesk.add(top, base, monitor, screen, chair)
    yourDesk.position.set(YOUR_DESK[0], 0, YOUR_DESK[1])
    yourDesk.traverse((o) => (o.userData.pick = { kind: 'crm' } satisfies Pick))
    yourDesk.userData.hover = 'Your desk: open the CRM'
    yourDesk.traverse((o) => (o.userData.hover = 'Your desk: click to open the CRM'))
    this.scene.add(yourDesk)

    // Printer.
    const printer = new THREE.Group()
    const stand = box(1.0, 0.6, 0.8, p.desk)
    stand.position.y = 0.3
    const body = box(0.9, 0.45, 0.7, 0xe4e6ea)
    body.position.y = 0.83
    const tray = box(0.6, 0.04, 0.3, 0x9aa3ae)
    tray.position.set(0, 1.07, 0.15)
    printer.add(stand, body, tray)
    printer.position.set(PRINTER[0], 0, PRINTER[1])
    this.scene.add(printer)

    // Entrance details.
    const mat = box(1.6, 0.02, 0.8, 0x6b5b4d)
    mat.position.set(2.3, 0.01, 11.3)
    const pot = box(0.5, 0.5, 0.5, 0x8a6e55)
    pot.position.set(0.8, 0.25, 6.6)
    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({ color: 0x4f8f5a }))
    plant.position.set(0.8, 0.85, 6.6)
    plant.castShadow = true
    this.scene.add(mat, pot, plant)

    // Ceiling access point over the pod.
    const apDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0xf2f4f7 }))
    apDisc.position.set(AP[0], AP[1], AP[2])
    const apMount = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x9aa3ae }))
    apMount.position.set(AP[0], AP[1] + 0.5, AP[2])
    this.scene.add(apDisc, apMount)
  }

  /** Syncs the drawn office with game state. Cheap when nothing changed. */
  update(s: GameState) {
    this.lastState = s
    const o = s.office
    if (!o) return
    const sig = JSON.stringify([
      o.desks,
      o.built,
      o.equipment,
      o.staff.map((x) => [x.id, x.role, x.ready, x.desk]),
      o.problems.map((x) => x.id),
    ])
    if (sig === this.signature) return
    this.signature = sig
    this.rebuildDynamic(s)
  }

  private rebuildDynamic(s: GameState) {
    const o = s.office!
    const p = this.palette
    this.dynamic.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m.dispose())
      }
    })
    this.dynamic.clear()
    this.markers = []
    this.people = []

    // Desks: bought ones are solid, the rest are outlines.
    DESK_POSITIONS.forEach(([x, z], i) => {
      if (i < o.desks) {
        const g = new THREE.Group()
        const top = box(1.4, 0.06, 0.7, p.deskTop)
        top.position.y = 0.74
        const legs = box(1.3, 0.7, 0.6, p.desk)
        legs.position.y = 0.35
        const mon = box(0.55, 0.36, 0.05, p.dark)
        mon.position.set(0, 1.0, -0.2)
        g.add(top, legs, mon)
        g.position.set(x, 0, z)
        this.dynamic.add(g)
      } else {
        this.dynamic.add(dashedOutline({ key: '', label: '', x0: x - 0.7, x1: x + 0.7, z0: z - 0.35, z1: z + 0.35 }, p.outline))
      }
    })

    // Staff at their desks.
    for (const member of o.staff) {
      const pos = DESK_POSITIONS[member.desk]
      if (!pos) continue
      const g = new THREE.Group()
      const color = member.ready ? ROLE_COLORS[member.role] : 0x9aa3ae
      const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), new THREE.MeshStandardMaterial({ color }))
      bodyMesh.position.y = 0.55
      bodyMesh.castShadow = true
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), new THREE.MeshStandardMaterial({ color: SKIN[member.id % SKIN.length] }))
      head.position.y = 1.07
      head.castShadow = true
      g.add(bodyMesh, head)
      if (!member.ready) {
        const boxMesh = box(0.5, 0.3, 0.4, 0xc9a77c)
        boxMesh.position.set(0, 0.92, -0.65)
        g.add(boxMesh)
      }
      g.position.set(pos[0], 0, pos[1] + 0.6)
      const role = { tier1: 'Tier 1 tech', tier2: 'Tier 2 tech', dispatcher: 'Dispatcher', internalIt: 'Internal IT tech' }[member.role]
      const hover = `${member.name}, ${role}${member.ready ? '' : ' (waiting for a laptop)'}`
      g.traverse((obj) => {
        obj.userData.pick = { kind: 'staff', id: member.id } satisfies Pick
        obj.userData.hover = hover
      })
      this.dynamic.add(g)
      this.people.push({ obj: g, phase: member.id * 1.7, working: member.ready })
    }

    // Server closet.
    if (o.built.closet) {
      const a = AREAS.closet
      const wall = box(0.12, 1.4, a.z1 - a.z0, p.wall)
      wall.position.set(a.x0, 0.7, (a.z0 + a.z1) / 2)
      const front = box(a.x1 - a.x0 - 1.4, 0.35, 0.12, p.wall)
      front.position.set((a.x0 + a.x1) / 2 + 0.7, 0.175, a.z1)
      const rack = box(0.9, 2.0, 0.9, 0x1d222b)
      rack.position.set(RACK[0], 1.0, RACK[1])
      const lights = box(0.7, 0.05, 0.02, 0x3ddc84, { emissive: 0x3ddc84, emissiveIntensity: 1 })
      lights.position.set(RACK[0], 1.4, RACK[1] + 0.46)
      const table = box(0.9, 0.6, 0.6, p.desk)
      table.position.set(NAS[0], 0.3, NAS[1])
      const nas = box(0.5, 0.4, 0.5, 0x3a4252)
      nas.position.set(NAS[0], 0.8, NAS[1])
      this.dynamic.add(wall, front, rack, lights, table, nas)
      if (o.equipment.offsiteBackup) {
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff }))
        cloud.position.set(NAS[0], 1.35, NAS[1])
        this.dynamic.add(cloud)
      }
    } else {
      this.dynamic.add(dashedOutline(AREAS.closet, p.outline))
    }

    // Break room.
    if (o.built.breakRoom) {
      const a = AREAS.breakRoom
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 24), new THREE.MeshStandardMaterial({ color: p.deskTop }))
      table.position.set(a.x0 + 1.4, 0.75, a.z0 + 2.2)
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.72, 8), new THREE.MeshStandardMaterial({ color: p.desk }))
      leg.position.set(a.x0 + 1.4, 0.36, a.z0 + 2.2)
      const couch = box(2.2, 0.45, 0.8, 0x6b7fa6)
      couch.position.set(a.x0 + 2.0, 0.225, a.z0 + 4.4)
      const back = box(2.2, 0.5, 0.2, 0x5d6f93)
      back.position.set(a.x0 + 2.0, 0.6, a.z0 + 4.75)
      const fridge = box(0.7, 1.6, 0.7, 0xe9ecf0)
      fridge.position.set(a.x1 - 0.6, 0.8, a.z0 + 0.6)
      table.castShadow = true
      this.dynamic.add(table, leg, couch, back, fridge)
    } else {
      this.dynamic.add(dashedOutline(AREAS.breakRoom, p.outline))
    }

    // Expansion stairs.
    if (o.built.expansion) {
      const a = AREAS.expansion
      for (let i = 0; i < 6; i++) {
        const step = box(1.6, 0.2 * (i + 1), 0.5, p.wall)
        step.position.set(a.x0 + 2.5, 0.1 * (i + 1), a.z1 - 0.5 - i * 0.5)
        this.dynamic.add(step)
      }
    } else {
      this.dynamic.add(dashedOutline(AREAS.expansion, p.outline))
    }

    // Mesh Wi-Fi: two extra access points.
    if (o.equipment.meshWifi) {
      for (const [x, z] of [
        [1.5, 1.5],
        [6.8, 4.5],
      ]) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 18), new THREE.MeshStandardMaterial({ color: 0xf2f4f7 }))
        disc.position.set(x, AP[1], z)
        this.dynamic.add(disc)
      }
    }

    // Problem markers float over whatever they affect.
    for (const prob of o.problems) {
      const info = PROBLEMS[prob.kind]
      let pos: [number, number, number] = [PRINTER[0], 1.9, PRINTER[1]]
      if (info.target === 'ap') pos = [AP[0], AP[1] + 0.9, AP[2]]
      if (info.target === 'rack') pos = [RACK[0], 2.8, RACK[1]]
      if (info.target === 'nas') pos = [NAS[0], 2.0, NAS[1]]
      if (info.target === 'desk') {
        const member = o.staff.find((x) => x.id === prob.staffId)
        const desk = member ? DESK_POSITIONS[member.desk] : undefined
        if (desk) pos = [desk[0], 2.0, desk[1] + 0.3]
      }
      const urgent = info.deadlineMs !== undefined || info.speed <= 0.5
      const color = urgent ? 0xe04848 : 0xf0a830
      const g = new THREE.Group()
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }),
      )
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.5, 28),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = -0.5
      // A larger invisible target makes markers easy to tap.
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ visible: false }))
      g.add(gem, ring, hit)
      g.position.set(...pos)
      g.traverse((obj) => {
        obj.userData.pick = { kind: 'problem', id: prob.id } satisfies Pick
        obj.userData.hover = `${info.label}: click to work it`
      })
      this.dynamic.add(g)
      this.markers.push(g)
    }
  }

  private pickAt(clientX: number, clientY: number): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.scene.children, true)
    // Problem markers win over whatever is behind them.
    const marker = hits.find((h) => h.object.userData.pick?.kind === 'problem')
    if (marker) return marker.object
    return hits.find((h) => h.object.userData.pick)?.object ?? null
  }

  private onClick = (e: MouseEvent) => {
    const obj = this.pickAt(e.clientX, e.clientY)
    if (obj) this.callbacks.onPick(obj.userData.pick as Pick)
  }

  private onMove = (e: PointerEvent) => {
    const obj = this.pickAt(e.clientX, e.clientY)
    this.renderer.domElement.style.cursor = obj ? 'pointer' : 'default'
    const rect = this.container.getBoundingClientRect()
    this.callbacks.onHover(obj ? (obj.userData.hover as string) : null, e.clientX - rect.left, e.clientY - rect.top)
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop)
    const t = this.clock.getElapsedTime()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    for (const m of this.markers) {
      m.children[0].rotation.y = t * 1.5
      m.children[0].position.y = reduced ? 0 : Math.sin(t * 3) * 0.08
      const pulse = reduced ? 1 : 1 + Math.sin(t * 4) * 0.12
      m.children[1].scale.set(pulse, pulse, pulse)
    }
    const slow = this.lastState?.office?.problems.some((x) => PROBLEMS[x.kind].speed < 1)
    for (const person of this.people) {
      if (!person.working || reduced) continue
      const rate = slow ? 3 : 7
      person.obj.position.y = Math.abs(Math.sin(t * rate + person.phase)) * 0.04
    }

    // Intro: start close on your desk, then pull back to the whole office.
    if (this.intro) {
      const k = Math.min(1, (t - this.intro.start) / this.intro.duration)
      const ease = 1 - Math.pow(1 - k, 3)
      this.camera.zoom = 4.5 + (1 - 4.5) * ease
      const focus = new THREE.Vector3(YOUR_DESK[0], 1, YOUR_DESK[1]).lerp(CENTER, ease)
      const offset = new THREE.Vector3(20, 20 * Math.SQRT2 * Math.tan((35.264 * Math.PI) / 180), 20)
      this.camera.position.copy(focus).add(offset)
      this.camera.lookAt(focus)
      this.camera.updateProjectionMatrix()
      if (k >= 1) {
        this.intro = null
        this.callbacks.onIntroDone()
      }
    }
    this.renderer.render(this.scene, this.camera)
  }
}
