// Three.js renderer for the stage 4 world map: an ocean with a stylized
// landmass per region, offices as small towers, and flight arcs from home.
import * as THREE from 'three'
import type { GameState } from '../game/engine'
import { WORLD_SLOTS } from '../game/worldContent'

export type WorldPick = { kind: 'home' } | { kind: 'region'; id: number } | { kind: 'slot'; slot: number } | { kind: 'event'; id: number }

export interface WorldCallbacks {
  onPick: (pick: WorldPick) => void
  onHover: (text: string | null, x: number, y: number) => void
  onIntroDone: () => void
}

/** Landmass centre and rough size per slot, laid out like a flattened world. */
const LAND: { x: number; z: number; w: number; d: number }[] = [
  { x: -8, z: -4, w: 7, d: 6 }, // home
  { x: -6, z: 5.5, w: 4.5, d: 5 }, // Latin America
  { x: 2, z: -6, w: 5, d: 3.6 }, // Europe
  { x: 2.5, z: 2.5, w: 4.5, d: 6 }, // Africa
  { x: 10, z: -2, w: 6, d: 6 }, // Asia Pacific
  { x: 6, z: -1.5, w: 2.6, d: 2.6 }, // Middle East
]

interface Palette {
  ocean: number
  land: number
  landOpen: number
  home: number
  tower: number
  arc: number
}
const LIGHT: Palette = { ocean: 0x9cc3e4, land: 0xd8d4c4, landOpen: 0xbcd5a8, home: 0xa9c8f0, tower: 0xf2f0ec, arc: 0x2f5fb8 }
const DARK: Palette = { ocean: 0x14263a, land: 0x34352f, landOpen: 0x2c4430, home: 0x2a3f66, tower: 0x3a4250, arc: 0x6f9cf5 }

function isDark(): boolean {
  const theme = document.documentElement.getAttribute('data-theme')
  if (theme) return theme === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function mesh(geo: THREE.BufferGeometry, color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts }))
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function label(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.font = '600 40px system-ui, -apple-system, Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.strokeText(text, 256, 48)
  ctx.fillStyle = color
  ctx.fillText(text, 256, 48)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }))
  sprite.scale.set(5.3, 1, 1)
  sprite.renderOrder = 10
  return sprite
}

const healthColor = (h: number) => (h >= 70 ? 0x2e9e5b : h >= 40 ? 0xe0a42e : 0xd64545)
const OFFSET = new THREE.Vector3(20, 20 * Math.SQRT2 * Math.tan((35.264 * Math.PI) / 180), 20)

export class WorldScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private dynamic = new THREE.Group()
  private markers: THREE.Object3D[] = []
  private planes: THREE.Object3D[] = []
  private signature = ''
  private palette: Palette
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private frame = 0
  private clock = new THREE.Clock()
  private intro: { start: number; duration: number } | null = null
  private resizeObserver: ResizeObserver

  constructor(
    private container: HTMLElement,
    private callbacks: WorldCallbacks,
  ) {
    this.palette = isDark() ? DARK : LIGHT
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    container.appendChild(this.renderer.domElement)
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    this.camera.position.copy(OFFSET).add(new THREE.Vector3(1, 0, 0))
    this.camera.lookAt(1, 0, 0)
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
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite || obj instanceof THREE.Line) {
        obj.geometry.dispose()
        const m = obj.material as THREE.MeshBasicMaterial
        m.map?.dispose()
        m.dispose()
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  playIntro() {
    this.intro = { start: this.clock.getElapsedTime(), duration: 2.6 }
  }

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h)
    const aspect = w / h
    const viewH = Math.max(17, 27 / aspect)
    this.camera.left = (-viewH * aspect) / 2
    this.camera.right = (viewH * aspect) / 2
    this.camera.top = viewH / 2
    this.camera.bottom = -viewH / 2
    this.camera.updateProjectionMatrix()
  }

  private buildStatic() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(10, 20, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18 })
    this.scene.add(sun)
    const ocean = mesh(new THREE.BoxGeometry(32, 0.4, 22), this.palette.ocean, { roughness: 0.5 })
    ocean.position.set(1, -0.2, 0)
    this.scene.add(ocean)
  }

  update(s: GameState) {
    if (!s.world || !s.region) return
    const sig = JSON.stringify([
      s.world.regions.map((r) => [r.id, r.slot, r.offices, r.clients, Math.round(r.health / 10)]),
      s.world.events.map((e) => [e.id, e.regionId]),
      s.region.sites.length,
    ])
    if (sig === this.signature) return
    this.signature = sig
    this.rebuild(s)
  }

  private rebuild(s: GameState) {
    const world = s.world!
    const p = this.palette
    this.dynamic.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite || obj instanceof THREE.Line) {
        obj.geometry.dispose()
        const m = obj.material as THREE.MeshBasicMaterial
        m.map?.dispose()
        m.dispose()
      }
    })
    this.dynamic.clear()
    this.markers = []
    this.planes = []
    const text = '#ffffff'

    WORLD_SLOTS.forEach((slot, i) => {
      const land = LAND[i]
      const region = world.regions.find((r) => r.slot === i)
      const home = i === 0
      const open = home || !!region
      const g = new THREE.Group()
      g.position.set(land.x, 0, land.z)
      const shape = new THREE.Shape()
      // A rounded, slightly irregular landmass.
      const pts = 14
      for (let k = 0; k <= pts; k++) {
        const a = (k / pts) * Math.PI * 2
        const wobble = 1 + Math.sin(a * 3 + i) * 0.08 + Math.cos(a * 5 + i * 2) * 0.05
        const x = Math.cos(a) * (land.w / 2) * wobble
        const z = Math.sin(a) * (land.d / 2) * wobble
        if (k === 0) shape.moveTo(x, z)
        else shape.lineTo(x, z)
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false })
      geo.rotateX(Math.PI / 2)
      geo.translate(0, 0.35, 0)
      const ground = mesh(geo, home ? p.home : open ? p.landOpen : p.land)
      g.add(ground)

      const towers = home ? Math.min(6, s.region!.sites.length) : region ? Math.min(8, region.offices) : 0
      for (let t = 0; t < towers; t++) {
        const h = 0.8 + ((t * 37) % 5) * 0.25
        const tower = mesh(new THREE.BoxGeometry(0.55, h, 0.55), p.tower)
        const col = t % 3
        const row = Math.floor(t / 3)
        tower.position.set((col - 1) * 0.8, 0.35 + h / 2, (row - 0.5) * 0.8)
        g.add(tower)
      }
      if (region) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.7, 1.95, 40, 1, 0, (Math.PI * 2 * Math.max(0.02, region.health)) / 100),
          new THREE.MeshBasicMaterial({ color: healthColor(region.health), side: THREE.DoubleSide }),
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.38
        g.add(ring)
      }
      const name = label(home ? 'Home region' : open ? slot.name : `${slot.name} (closed)`, text)
      name.position.set(0, 2.6, 0)
      g.add(name)
      const pick: WorldPick = home ? { kind: 'home' } : region ? { kind: 'region', id: region.id } : { kind: 'slot', slot: i }
      const hover = home
        ? `Your home region: ${s.region!.sites.length} sites. Click to open the regional map.`
        : region
          ? `${slot.name}: ${region.offices} offices, ${region.clients} clients, ${Math.round(region.health)}% health`
          : `${slot.name}: click to see what it takes to enter`
      g.traverse((o) => {
        o.userData.pick = pick
        o.userData.hover = hover
      })
      this.dynamic.add(g)

      // Flight arc from home to every open region.
      if (region) {
        const a = new THREE.Vector3(LAND[0].x, 0.4, LAND[0].z)
        const b = new THREE.Vector3(land.x, 0.4, land.z)
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 3 + a.distanceTo(b) * 0.15, 0))
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
          new THREE.LineDashedMaterial({ color: p.arc, dashSize: 0.35, gapSize: 0.25 }),
        )
        line.computeLineDistances()
        this.dynamic.add(line)
        const plane = mesh(new THREE.ConeGeometry(0.16, 0.5, 6), p.arc)
        plane.userData.curve = curve
        plane.userData.phase = i * 0.37
        this.dynamic.add(plane)
        this.planes.push(plane)
      }

      const ev = region && world.events.find((e) => e.regionId === region.id)
      if (ev) {
        const m = new THREE.Group()
        const gem = mesh(new THREE.OctahedronGeometry(0.45), 0xe0a42e, { emissive: 0x6b4a10, roughness: 0.4 })
        const glow = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.75, 24),
          new THREE.MeshBasicMaterial({ color: 0xe0a42e, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
        )
        glow.rotation.x = -Math.PI / 2
        glow.position.y = -0.6
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false }))
        m.add(gem, glow, hit)
        m.position.set(land.x + 1.4, 3.4, land.z + 1)
        m.traverse((o) => {
          o.userData.pick = { kind: 'event', id: ev.id } satisfies WorldPick
          o.userData.hover = 'Event: click to handle it'
        })
        this.dynamic.add(m)
        this.markers.push(m)
      }
    })
  }

  private pickAt(clientX: number, clientY: number): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.dynamic.children, true)
    const marker = hits.find((h) => h.object.userData.pick?.kind === 'event')
    if (marker) return marker.object
    return hits.find((h) => h.object.userData.pick)?.object ?? null
  }

  private onClick = (e: MouseEvent) => {
    const obj = this.pickAt(e.clientX, e.clientY)
    if (obj) this.callbacks.onPick(obj.userData.pick as WorldPick)
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
      m.children[0].position.y = reduced ? 0 : Math.sin(t * 3) * 0.12
      const pulse = reduced ? 1 : 1 + Math.sin(t * 4) * 0.12
      m.children[1].scale.set(pulse, pulse, pulse)
    }
    for (const plane of this.planes) {
      const curve = plane.userData.curve as THREE.QuadraticBezierCurve3
      const k = reduced ? 0.5 : (t * 0.12 + plane.userData.phase) % 1
      plane.position.copy(curve.getPoint(k))
      const ahead = curve.getPoint(Math.min(1, k + 0.01))
      plane.lookAt(ahead)
      plane.rotateX(Math.PI / 2)
    }
    if (this.intro) {
      const k = Math.min(1, (t - this.intro.start) / this.intro.duration)
      const ease = 1 - Math.pow(1 - k, 3)
      this.camera.zoom = 4 + (1 - 4) * ease
      this.camera.updateProjectionMatrix()
      if (k >= 1) {
        this.intro = null
        this.callbacks.onIntroDone()
      }
    }
    this.renderer.render(this.scene, this.camera)
  }
}
