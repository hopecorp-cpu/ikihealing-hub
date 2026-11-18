"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Clone, Environment, Html, OrbitControls, SoftShadows, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MayChay, TrangThai } from "@/lib/may-chay-ngam";
import { timPhong, type MaPhong, type Phong } from "@/lib/thi-tran";
import type { PhongLive, ThiTranData } from "@/lib/thi-tran-server";
import { useLang } from "@/components/lang-provider";
import type { TDich } from "@/lib/i18n";

const LUOI: MaPhong[] = ["th", "mkt", "kd", "cskh", "tlgd", "vhsp", "ns", "tc", "kt"];
const RONG = 8, SAU = 6, CAO = 2.6, BUOC_X = 10, BUOC_Z = 8.4;
const AO: Record<TrangThai, string> = { chay: "#10B981", chet: "#F43F5E", "chua-ro": "#94A3B8", tat: "#64748B" };
const TOI_DA_NGUOI = 8;

const TS = "/thi-tran-may/3d/";
const MO_HINH = { cay: TS + "potted_plant_01.glb", sofa: TS + "Sofa_01.glb", banTra: TS + "modern_coffee_table_01.glb" };

const tamPhong = (id: MaPhong): [number, number] => {
  const i = LUOI.indexOf(id);
  return [((i % 3) - 1) * BUOC_X, (Math.floor(i / 3) - 1) * BUOC_Z];
};

type Mau = {
  troi: string; thamPhong: string; thamGiua: string; hanhLang: string; go: string; khungBan: string; vach: string;
  ghe: string; thamTrai: string; kinh: string; khung: string; tuGo: string; nhaXa: string; cuaSoXa: string; den: number; manHinh: number;
};

const MAU_SANG: Mau = {
  troi: "#C9DCEB", thamPhong: "#8F959E", thamGiua: "#8F7F70", hanhLang: "#CDD3DA", go: "#C9A27C", khungBan: "#F1F3F5", vach: "#2B3E5C",
  ghe: "#1C1F24", thamTrai: "#D5D8DD", kinh: "#CFE6F5", khung: "#14171C", tuGo: "#B8906B", nhaXa: "#8FA6BC", cuaSoXa: "#DCE8F2", den: 0.9, manHinh: 0.35,
};
const MAU_TOI: Mau = {
  troi: "#0A1222", thamPhong: "#2F353F", thamGiua: "#3A3129", hanhLang: "#1E242D", go: "#8A6A4E", khungBan: "#CBD2DA", vach: "#24344F",
  ghe: "#0E1014", thamTrai: "#2B2F36", kinh: "#5B7A96", khung: "#5B6675", tuGo: "#6E543E", nhaXa: "#1A2537", cuaSoXa: "#FCD58A", den: 2.2, manHinh: 0.9,
};

function Hop({ p, s, mau, op = 1, bong = true, emissive, sang = 0.6, kimLoai = 0, nham = 0.7, onClick }: {
  p: [number, number, number]; s: [number, number, number]; mau: string; op?: number; bong?: boolean; emissive?: string; sang?: number;
  kimLoai?: number; nham?: number; onClick?: (e: any) => void;
}) {
  return (
    <mesh position={p} castShadow={bong} receiveShadow onClick={onClick}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={mau} transparent={op < 1} opacity={op} emissive={emissive || "#000"} emissiveIntensity={emissive ? sang : 0}
        roughness={nham} metalness={kimLoai} />
    </mesh>
  );
}

function Ghe({ x, z, quay, m }: { x: number; z: number; quay: number; m: Mau }) {
  return (
    <group position={[x, 0, z]} rotation={[0, quay, 0]}>
      <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.3, 0.3, 0.04, 5]} /><meshStandardMaterial color="#2A2E35" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 0.26, 0]}><cylinderGeometry args={[0.03, 0.03, 0.4, 8]} /><meshStandardMaterial color="#8C939D" metalness={0.8} roughness={0.3} /></mesh>
      <Hop p={[0, 0.48, 0]} s={[0.5, 0.08, 0.48]} mau={m.ghe} />
      <Hop p={[0, 0.86, 0.22]} s={[0.46, 0.62, 0.05]} mau={m.ghe} nham={0.9} />
      <Hop p={[0, 1.26, 0.23]} s={[0.3, 0.13, 0.05]} mau={m.ghe} />
      <Hop p={[-0.27, 0.64, 0.02]} s={[0.04, 0.04, 0.32]} mau="#2A2E35" bong={false} />
      <Hop p={[0.27, 0.64, 0.02]} s={[0.04, 0.04, 0.32]} mau="#2A2E35" bong={false} />
    </group>
  );
}

function ChoNgoi({ m }: { m: Mau }) {
  const go = useTexture(TS + "wood_table_001_diff_1k.jpg");
  go.colorSpace = THREE.SRGBColorSpace;
  return (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.38, 0.04, 0.72]} />
        <meshStandardMaterial map={go} color={m === MAU_TOI ? "#9C8877" : "#ffffff"} roughness={0.45} />
      </mesh>
      <Hop p={[0.47, 0.36, 0.02]} s={[0.4, 0.62, 0.6]} mau={m.khungBan} />
      <Hop p={[0.47, 0.5, 0.33]} s={[0.36, 0.005, 0.01]} mau="#9AA3AE" bong={false} />
      <Hop p={[0.47, 0.32, 0.33]} s={[0.36, 0.005, 0.01]} mau="#9AA3AE" bong={false} />
      {[-0.22, 0.24].map((x, i) => (
        <group key={i} position={[x, 0, -0.16]} rotation={[0, i ? -0.18 : 0.18, 0]}>
          <Hop p={[0, 1.0, 0]} s={[0.46, 0.28, 0.025]} mau="#0B0D10" emissive="#BFD8F5" sang={m.manHinh} bong={false} nham={0.3} />
          <Hop p={[0, 0.82, 0.02]} s={[0.04, 0.12, 0.04]} mau="#2A2E35" bong={false} />
        </group>
      ))}
      <Hop p={[0, 0.765, 0.12]} s={[0.42, 0.012, 0.13]} mau="#E5E7EB" bong={false} />
    </group>
  );
}

function CumBan({ x, z, m, vach }: { x: number; z: number; m: Mau; vach: string }) {
  const chan = (cx: number, cz: number, k: number) => <Hop key={k} p={[cx, 0.37, cz]} s={[0.04, 0.72, 0.04]} mau={m.khungBan} kimLoai={0.4} />;
  return (
    <group position={[x, 0, z]}>
      {[-0.7, 0.7].map((dx) => (
        <group key={dx}>
          <group position={[dx, 0, -0.38]} rotation={[0, Math.PI, 0]}><ChoNgoi m={m} /></group>
          <group position={[dx, 0, 0.38]}><ChoNgoi m={m} /></group>
        </group>
      ))}
      {chan(-1.38, -0.72, 1)}{chan(1.38, -0.72, 2)}{chan(-1.38, 0.72, 3)}{chan(1.38, 0.72, 4)}{chan(0, -0.72, 5)}{chan(0, 0.72, 6)}
      <Hop p={[0, 0.95, 0]} s={[2.76, 0.4, 0.04]} mau={vach} nham={1} />
      <Ghe x={-0.75} z={-1.05} quay={0} m={m} /><Ghe x={0.75} z={-1.05} quay={0} m={m} />
      <Ghe x={-0.75} z={1.05} quay={Math.PI} m={m} /><Ghe x={0.75} z={1.05} quay={Math.PI} m={m} />
      <Hop p={[0, 2.3, 0]} s={[2.6, 0.035, 0.07]} mau="#1A1D22" emissive="#FFE3B3" sang={m.den} bong={false} />
      <Hop p={[-1.1, 2.46, 0]} s={[0.006, 0.3, 0.006]} mau="#1A1D22" bong={false} />
      <Hop p={[1.1, 2.46, 0]} s={[0.006, 0.3, 0.006]} mau="#1A1D22" bong={false} />
    </group>
  );
}

function CayLon({ x, z, to = 1 }: { x: number; z: number; to?: number }) {
  const { scene } = useGLTF(MO_HINH.cay);
  return <Clone object={scene} position={[x, 0.06, z]} scale={to * 1.15} rotation={[0, (x * 7 + z * 3) % 6.28, 0]} castShadow receiveShadow />;
}

function MoHinh({ url, p, quay = 0, to = 1 }: { url: string; p: [number, number, number]; quay?: number; to?: number }) {
  const { scene } = useGLTF(url);
  return <Clone object={scene} position={p} rotation={[0, quay, 0]} scale={to} castShadow receiveShadow />;
}

function TuongKinh({ mau, m, vienDo }: { mau: string; m: Mau; vienDo: boolean }) {
  const w = RONG / 2, d = SAU / 2, cua = 1.4, op = 0.16;
  const ben = w - cua / 2;
  const doc: [number, number][] = [];
  for (let x = -w; x <= w + 0.01; x += RONG / 6) doc.push([x, -d]);
  for (let z = -d + SAU / 4; z < d; z += SAU / 4) { doc.push([-w, z]); doc.push([w, z]); }
  doc.push([-w, d], [w, d], [-cua / 2, d], [cua / 2, d], [-(cua / 2 + ben / 2), d], [cua / 2 + ben / 2, d]);
  const dau = vienDo ? "#F43F5E" : m.khung;
  return (
    <group>
      <Hop p={[0, CAO / 2, -d]} s={[RONG, CAO, 0.03]} mau={m.kinh} op={op} bong={false} nham={0.05} />
      <Hop p={[-w, CAO / 2, 0]} s={[0.03, CAO, SAU]} mau={m.kinh} op={op} bong={false} nham={0.05} />
      <Hop p={[w, CAO / 2, 0]} s={[0.03, CAO, SAU]} mau={m.kinh} op={op} bong={false} nham={0.05} />
      <Hop p={[-(cua / 2 + ben / 2), CAO / 2, d]} s={[ben, CAO, 0.03]} mau={m.kinh} op={op} bong={false} nham={0.05} />
      <Hop p={[cua / 2 + ben / 2, CAO / 2, d]} s={[ben, CAO, 0.03]} mau={m.kinh} op={op} bong={false} nham={0.05} />
      {doc.map(([x, z], i) => <Hop key={i} p={[x, CAO / 2, z]} s={[0.045, CAO, 0.045]} mau={m.khung} kimLoai={0.5} nham={0.4} bong={false} />)}
      <Hop p={[0, CAO, -d]} s={[RONG + 0.05, 0.08, 0.08]} mau={dau} kimLoai={0.5} />
      <Hop p={[-w, CAO, 0]} s={[0.08, 0.08, SAU]} mau={dau} kimLoai={0.5} />
      <Hop p={[w, CAO, 0]} s={[0.08, 0.08, SAU]} mau={dau} kimLoai={0.5} />
      <Hop p={[0, CAO, d]} s={[RONG + 0.05, 0.08, 0.08]} mau={dau} kimLoai={0.5} />
      <Hop p={[0, 0.06, -d]} s={[RONG, 0.06, 0.06]} mau={m.khung} bong={false} />
      <Hop p={[-(cua / 2 + ben / 2), 1.15, d + 0.02]} s={[ben, 0.06, 0.005]} mau={mau} bong={false} emissive={mau} sang={0.25} />
      <Hop p={[cua / 2 + ben / 2, 1.15, d + 0.02]} s={[ben, 0.06, 0.005]} mau={mau} bong={false} emissive={mau} sang={0.25} />
    </group>
  );
}

function Nguoi({ tex, m, x, z, dichuyen, chon, gan, onChon, t }: {
  tex: THREE.Texture; m: MayChay; t: TDich; x: number; z: number; dichuyen?: [number, number][]; chon: boolean; gan: boolean; onChon: (m: MayChay) => void;
}) {
  const g = useRef<THREE.Group>(null);
  const vong = useRef<THREE.Mesh>(null);
  const cao = 1.72;
  const anh = tex.image as { width: number; height: number } | undefined;
  const rong = anh ? (cao * anh.width) / anh.height : 0.6;
  const lech = useMemo(() => (m.key.length * 0.37) % 6, [m.key]);
  const xam = m.trangThai === "tat" || m.trangThai === "chua-ro";

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + lech;
    if (g.current && dichuyen && dichuyen.length > 1 && m.trangThai === "chay") {

      const n = dichuyen.length, k = (t / 4) % n, i = Math.floor(k), f = k - i;
      const a = dichuyen[i], b = dichuyen[(i + 1) % n];
      g.current.position.set(a[0] + (b[0] - a[0]) * f, Math.abs(Math.sin(t * 6)) * 0.03, a[1] + (b[1] - a[1]) * f);
    }
    if (vong.current && m.trangThai === "chet") {
      const s = 1 + ((t * 0.8) % 1) * 0.8;
      vong.current.scale.set(s, s, s);
      (vong.current.material as THREE.MeshBasicMaterial).opacity = 1 - ((t * 0.8) % 1);
    }
  });

  return (
    <group ref={g} position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); onChon(m); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.32, 24]} />
        <meshBasicMaterial color={AO[m.trangThai]} transparent opacity={0.75} />
      </mesh>
      {chon && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.42, 0.5, 32]} /><meshBasicMaterial color="#0F172A" />
        </mesh>
      )}
      {m.trangThai === "chet" && (
        <mesh ref={vong} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.36, 0.44, 32]} /><meshBasicMaterial color="#F43F5E" transparent />
        </mesh>
      )}
      <Billboard position={[0, cao / 2 + 0.02, 0]} lockX lockZ>
        <mesh castShadow>
          <planeGeometry args={[rong, cao]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.4} color={xam ? "#9CA3AF" : "#ffffff"} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
      {m.trangThai === "chet" && gan && (
        <Html position={[0, cao + 0.25, 0]} center style={{ pointerEvents: "none" }}>
          <div style={{ background: "#F43F5E", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>{t("đứt")}</div>
        </Html>
      )}
    </group>
  );
}

function PhongKinh3D({ p, pl, m, tex, canAnh, chon, anNhan, mayChon, onMo, onChonMay, t }: {
  t: TDich;
  p: Phong; pl: PhongLive; m: Mau; tex: THREE.Texture; canAnh: number; chon: boolean; anNhan: boolean; mayChon: MayChay | null;
  onMo: () => void; onChonMay: (m: MayChay) => void;
}) {
  const [cx, cz] = tamPhong(p.id);
  const giua = p.id === "tlgd";
  const may = pl.boPhan.flatMap((b) => b.may);
  const xep = [...may].sort((a, b) => (a.trangThai === "chet" ? 0 : 1) - (b.trangThai === "chet" ? 0 : 1)).slice(0, TOI_DA_NGUOI);
  const choAnh = pl.dem.grokChoAnh + canAnh > 0;
  const den = useRef<THREE.Mesh>(null);
  const gon = useThree((s) => s.size.width < 640) && !chon;
  useFrame(({ clock }) => {
    if (den.current) (den.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 3) * 0.4;
  });

  const CUM_X = [-1.8, 1.8], CUM_Z = -0.1;
  const choNguoi: [number, number][] = CUM_X.flatMap((px) => [-1, 1].flatMap((sz) => [-0.75, 0.75].map((dx) =>
    [px + dx + 0.34, CUM_Z + sz * 1.22] as [number, number])));
  const vach = useMemo(() => "#" + new THREE.Color(p.mau).lerp(new THREE.Color(m.vach), 0.6).getHexString(), [p.mau, m.vach]);
  const duongDi: [number, number][] = [[-3.5, -2.3], [3.5, -2.3], [3.5, 2.45], [-3.5, 2.45]];
  const viTriNguoi = (i: number): [number, number] => giua
    ? ([[-2.4, 0.9], [-1.3, 1.9], [1.3, 1.9], [2.4, 0.9]][i % 4] as [number, number])
    : choNguoi[i % choNguoi.length];

  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.03, 0]} receiveShadow onClick={(e) => { e.stopPropagation(); onMo(); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <boxGeometry args={[RONG, 0.06, SAU]} />
        <meshStandardMaterial color={giua ? m.thamGiua : m.thamPhong} roughness={1} />
      </mesh>
      {chon && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <planeGeometry args={[RONG, SAU]} /><meshBasicMaterial color={p.mau} transparent opacity={0.12} />
        </mesh>
      )}
      <TuongKinh mau={p.mau} m={m} vienDo={pl.dem.dut > 0} />

      {giua ? (
        <group>
          <Hop p={[0, 0.065, 0.2]} s={[5.4, 0.01, 3.6]} mau={m.thamTrai} bong={false} nham={1} />
          <Hop p={[0, 0.76, -0.9]} s={[2.8, 0.06, 1.1]} mau="#5A3E2B" nham={0.4} />
          <Hop p={[-1.25, 0.38, -0.9]} s={[0.12, 0.72, 1]} mau="#3E2A1D" />
          <Hop p={[1.25, 0.38, -0.9]} s={[0.12, 0.72, 1]} mau="#3E2A1D" />
          <Hop p={[0, 0.5, -1.35]} s={[2.4, 0.5, 0.06]} mau="#3E2A1D" />
          <Hop p={[0, 1.02, -1.2]} s={[0.9, 0.48, 0.03]} mau="#0B0D10" emissive="#BFD8F5" sang={m.manHinh} bong={false} />
          <group position={[0, 0, -1.85]} rotation={[0, 0, 0]}>
            <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.34, 0.34, 0.04, 5]} /><meshStandardMaterial color="#2A2E35" metalness={0.6} /></mesh>
            <Hop p={[0, 0.5, 0]} s={[0.62, 0.14, 0.58]} mau="#3B2418" nham={0.45} />
            <Hop p={[0, 1.02, -0.27]} s={[0.6, 0.95, 0.12]} mau="#3B2418" nham={0.45} />
          </group>
          <Ghe x={-0.6} z={0.1} quay={Math.PI} m={m} /><Ghe x={0.6} z={0.1} quay={Math.PI} m={m} />
          <MoHinh url={MO_HINH.sofa} p={[2.5, 0.06, 2.35]} quay={Math.PI} to={1.15} />
          <MoHinh url={MO_HINH.banTra} p={[2.5, 0.06, 1.45]} quay={Math.PI / 2} to={1} />
          <Hop p={[0, 1.45, -2.86]} s={[6.4, 2.2, 0.1]} mau="#1A1D22" />
          <Hop p={[0, 1.55, -2.8]} s={[3.2, 1.5, 0.02]} mau="#0B0D10" emissive="#0EA5E9" sang={0.7} bong={false} />
          <Hop p={[-2.45, 1.55, -2.8]} s={[1.3, 0.8, 0.02]} mau="#0B0D10" emissive="#22C55E" sang={0.6} bong={false} />
          <Hop p={[2.45, 1.55, -2.8]} s={[1.3, 0.8, 0.02]} mau="#0B0D10" emissive="#F59E0B" sang={0.6} bong={false} />
          <Hop p={[0, 2.35, 0.2]} s={[3.4, 0.035, 0.07]} mau="#1A1D22" emissive="#FFE3B3" sang={m.den} bong={false} />
          <QuaCauGrok t={t} />
          <CayLon x={-3.45} z={-2.45} to={1.15} /><CayLon x={-3.45} z={2.4} />
        </group>
      ) : (
        <group>
          {CUM_X.map((x) => <CumBan key={x} x={x} z={CUM_Z} m={m} vach={vach} />)}
          <Hop p={[0, 0.36, -2.72]} s={[5.2, 0.72, 0.42]} mau={m.tuGo} nham={0.55} />
          <Hop p={[0, 0.73, -2.72]} s={[5.24, 0.03, 0.44]} mau={m.khungBan} bong={false} />
          <CayLon x={-3.45} z={-2.5} /><CayLon x={3.45} z={-2.5} to={0.85} />
        </group>
      )}

      {xep.map((may, i) => {
        const [x, z] = viTriNguoi(i);
        const diDao = i === 0 && !giua && may.trangThai === "chay";
        return <Nguoi key={may.key} tex={tex} m={may} x={x} z={z} dichuyen={diDao ? duongDi : undefined} chon={mayChon?.key === may.key} gan={chon} onChon={onChonMay} t={t} />;
      })}

      {choAnh && (
        <mesh ref={den} position={[RONG / 2 - 0.4, CAO + 0.25, -SAU / 2 + 0.4]}>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={1} />
        </mesh>
      )}

      {!anNhan && <Html position={[0, CAO + 0.9, -SAU / 2]} center zIndexRange={[20, 0]}>
        <button type="button" onClick={onMo}
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: "rgba(255,255,255,.95)", color: "#0F172A",
            border: `2px solid ${pl.dem.dut ? "#F43F5E" : p.mau}`, borderRadius: 8, padding: gon ? "2px 6px" : "3px 8px", fontSize: gon ? 11 : 12, fontWeight: 700,
            boxShadow: "0 4px 14px rgba(15,23,42,.18)", cursor: "pointer" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: p.mau }} />
          {giua ? (gon ? "MausBot" : t("Giám đốc + MausBot")) : t(p.ngan)}
          {!gon && <span style={{ fontWeight: 600, opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>{pl.dem.chay}/{pl.dem.may}</span>}
          {pl.dem.dut > 0 && <span style={{ background: "#F43F5E", color: "#fff", borderRadius: 6, padding: "0 6px", fontSize: 11 }}>{pl.dem.dut}{gon ? "" : ` ${t("đứt")}`}</span>}
          {choAnh && !gon && <span style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 6, padding: "0 6px", fontSize: 11 }}>{t("chờ anh")}</span>}
        </button>
      </Html>}
    </group>
  );
}

function QuaCauGrok({ t }: { t: TDich }) {
  const r = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const s = clock.getElapsedTime();
    if (r.current) { r.current.position.y = 2 + Math.sin(s * 1.6) * 0.12; r.current.rotation.y = s * 0.6; }
  });
  return (
    <group ref={r} position={[0, 2, 0.6]}>
      <mesh><icosahedronGeometry args={[0.42, 1]} /><meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={0.9} flatShading /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.7, 0.025, 8, 48]} /><meshBasicMaterial color="#7DD3FC" /></mesh>
      <Html position={[0, 0.85, 0]} center style={{ pointerEvents: "none" }}>
        <div style={{ background: "#0369A1", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{t("MausBot điều phối")}</div>
      </Html>
    </group>
  );
}

function useCuaSo(mauNen: string, mauDen: string, toi: boolean) {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = mauNen; g.fillRect(0, 0, 64, 128);
    for (let y = 2; y < 128; y += 6) for (let x = 2; x < 64; x += 8) {
      const bat = toi ? ((x * 13 + y * 7) % 11) < 5 : ((x * 5 + y * 3) % 7) < 5;
      g.fillStyle = bat ? mauDen : mauNen; g.globalAlpha = bat ? (toi ? 0.95 : 0.55) : 1; g.fillRect(x, y, 6, 4);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, [mauNen, mauDen, toi]);
}

function NgoaiCanh({ m, toi }: { m: Mau; toi: boolean }) {
  const cuaSo = useCuaSo(m.nhaXa, m.cuaSoXa, toi);
  const nha = useMemo(() => {
    const v: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let i = 0; i < 16; i++) v.push({ x: -44 + i * 6.2, z: -34 - (i % 3) * 7, w: 4 + (i % 3), d: 4 + ((i * 3) % 3), h: 18 + ((i * 37) % 26) });
    for (let i = 0; i < 9; i++) v.push({ x: -36 - (i % 2) * 8, z: -24 + i * 6.5, w: 4 + (i % 2), d: 4, h: 14 + ((i * 29) % 22) });
    return v;
  }, []);
  const W = 16.6, D = 13.6, H = 3.2;
  return (
    <group>
      <mesh position={[0, -0.25, 0]} receiveShadow><boxGeometry args={[W * 2, 0.5, D * 2]} /><meshStandardMaterial color={m.hanhLang} roughness={0.35} metalness={0.05} /></mesh>
      <Hop p={[0, -0.25, D]} s={[W * 2, 0.52, 0.12]} mau="#1A1D22" bong={false} />
      <Hop p={[W, -0.25, 0]} s={[0.12, 0.52, D * 2]} mau="#1A1D22" bong={false} />
      <Hop p={[0, H / 2, -D]} s={[W * 2, H, 0.04]} mau={m.kinh} op={0.12} bong={false} nham={0.05} />
      <Hop p={[-W, H / 2, 0]} s={[0.04, H, D * 2]} mau={m.kinh} op={0.12} bong={false} nham={0.05} />
      {Array.from({ length: 14 }, (_, i) => -W + i * (2 * W / 13)).map((x, i) => <Hop key={"a" + i} p={[x, H / 2, -D]} s={[0.07, H, 0.07]} mau={m.khung} bong={false} />)}
      {Array.from({ length: 11 }, (_, i) => -D + i * (2 * D / 10)).map((z, i) => <Hop key={"b" + i} p={[-W, H / 2, z]} s={[0.07, H, 0.07]} mau={m.khung} bong={false} />)}
      <Hop p={[0, H, -D]} s={[W * 2, 0.1, 0.1]} mau={m.khung} bong={false} />
      <Hop p={[-W, H, 0]} s={[0.1, 0.1, D * 2]} mau={m.khung} bong={false} />
      {([[-W + 0.4, -D + 0.4], [W - 0.4, -D + 0.4], [-W + 0.4, D - 0.4], [0, -D + 0.4], [-W + 0.4, 0]] as const).map(([x, z], i) => (
        <Hop key={"c" + i} p={[x, H / 2, z]} s={[0.6, H, 0.6]} mau={toi ? "#2A313B" : "#F2F4F6"} />
      ))}
      <CayLon x={-15.6} z={-12.6} to={1.2} /><CayLon x={15.6} z={-12.6} to={1.2} /><CayLon x={-15.6} z={12.6} to={1.1} />
      <CayLon x={-5} z={-12.7} /><CayLon x={5} z={-12.7} /><CayLon x={-15.7} z={-4.2} /><CayLon x={-15.7} z={4.2} />
      {nha.map((b, i) => (
        <mesh key={"n" + i} position={[b.x, b.h / 2 - 30, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial map={cuaSo} emissiveMap={toi ? cuaSo : null} emissive={toi ? "#ffffff" : "#000000"} emissiveIntensity={toi ? 0.7 : 0}
            color="#ffffff" roughness={0.3} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function DieuKhienCamera({ chon }: { chon: MaPhong | null }) {
  const { camera, size } = useThree();

  const doc = size.width / size.height < 1;
  const ctl = useRef<OrbitControlsImpl>(null);
  const dich = useRef<{ p: THREE.Vector3; t: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (chon) {
      const [x, z] = tamPhong(chon);
      dich.current = { p: new THREE.Vector3(x + 3, 7, z + 8.5), t: new THREE.Vector3(x, 0.6, z - 0.3) };
    } else {
      dich.current = { p: doc ? new THREE.Vector3(0, 66, 30) : new THREE.Vector3(14, 24, 30), t: new THREE.Vector3(0, 0, 0) };
    }
  }, [chon, doc]);
  useFrame(() => {
    const d = dich.current;
    if (!d || !ctl.current) return;
    camera.position.lerp(d.p, 0.06);
    ctl.current.target.lerp(d.t, 0.06);
    ctl.current.update();
    if (camera.position.distanceTo(d.p) < 0.05) dich.current = null;
  });
  return (
    <OrbitControls ref={ctl} makeDefault enableDamping maxPolarAngle={1.3} minDistance={5} maxDistance={90}
      onStart={() => { dich.current = null; }} />
  );
}

function Canh({ d, toi, chon, mayChon, onMo, onChonMay, t }: {
  t: TDich; d: ThiTranData; toi: boolean; chon: MaPhong | null; mayChon: MayChay | null; onMo: (id: MaPhong) => void; onChonMay: (m: MayChay) => void;
}) {
  const m = toi ? MAU_TOI : MAU_SANG;
  const tex = useTexture(Object.fromEntries(LUOI.map((id) => [id, `/thi-tran-may/tang/nguoi-${id}.webp`])) as Record<MaPhong, string>);
  useEffect(() => { for (const t of Object.values(tex)) (t as THREE.Texture).colorSpace = THREE.SRGBColorSpace; }, [tex]);
  const canAnh = new Map<string, number>();
  for (const x of d.vong.deXuat) if (x.canAnh) canAnh.set(x.phong, (canAnh.get(x.phong) || 0) + 1);
  return (
    <>
      <color attach="background" args={[m.troi]} />
      <fog attach="fog" args={[m.troi, 55, 120]} />
      <SoftShadows size={18} samples={10} focus={0.6} />
      <Environment files={TS + "studio_small_09_1k.hdr"} environmentIntensity={toi ? 0.25 : 0.35} />
      <ambientLight intensity={toi ? 0.2 : 0.15} />
      <hemisphereLight args={[toi ? "#3B4A66" : "#EAF2FB", toi ? "#141820" : "#B9A58F", toi ? 0.45 : 0.35]} />
      <directionalLight position={[-22, 20, -16]} color={toi ? "#8FA7D6" : "#FFE6C7"} intensity={toi ? 0.5 : 1.35} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0005}
        shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <directionalLight position={[16, 18, 20]} intensity={toi ? 0.25 : 0.45} color="#ffffff" />
      <NgoaiCanh m={m} toi={toi} />
      {LUOI.map((id) => (
        <PhongKinh3D key={id} p={timPhong(id)!} pl={d.phong.find((x) => x.id === id)!} m={m} tex={(tex as Record<MaPhong, THREE.Texture>)[id]}
          canAnh={canAnh.get(id) || 0} chon={chon === id} anNhan={!!chon && chon !== id} mayChon={mayChon} onMo={() => onMo(id)} onChonMay={onChonMay} t={t} />
      ))}
      <DieuKhienCamera chon={chon} />
    </>
  );
}

export default function VanPhong3D({ d, toi, chon, mayChon, onMo, onToanCanh, onChonMay }: {
  d: ThiTranData; toi: boolean; chon: MaPhong | null; mayChon: MayChay | null;
  onMo: (id: MaPhong) => void; onToanCanh: () => void; onChonMay: (m: MayChay) => void;
}) {
  const [coWebgl, setCoWebgl] = useState(true);
  const { t } = useLang();
  useEffect(() => {
    try { const c = document.createElement("canvas"); setCoWebgl(!!(c.getContext("webgl2") || c.getContext("webgl"))); } catch { setCoWebgl(false); }
    return () => { document.body.style.cursor = ""; };
  }, []);
  if (!coWebgl) {
    return <div className="p-6 text-[13px] opacity-75">{t("Máy này không bật được đồ hoạ 3D (WebGL). Anh xem bằng Sơ đồ tầng hoặc Bản đồ điều phối.")}</div>;
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 px-3 pt-3">
        <button type="button" onClick={onToanCanh}
          className={`rounded-md px-2.5 py-1 text-[12px] border ${!chon ? "bg-teal-600 text-white border-teal-600" : ""}`}
          style={chon ? { background: "var(--ttm-nen)", borderColor: "var(--ttm-vien)" } : undefined}>{t("Toàn cảnh")}</button>
        {LUOI.map((id) => {
          const p = timPhong(id)!;
          return (
            <button key={id} type="button" onClick={() => onMo(id)}
              className="rounded-md px-2.5 py-1 text-[12px] border inline-flex items-center gap-1.5"
              style={{ background: chon === id ? p.mau : "var(--ttm-nen)", color: chon === id ? "#fff" : undefined, borderColor: chon === id ? p.mau : "var(--ttm-vien)" }}>
              <span className="w-2 h-2 rounded-sm" style={{ background: chon === id ? "#fff" : p.mau }} />
              {id === "tlgd" ? t("Giám đốc") : t(p.ngan)}
            </button>
          );
        })}
      </div>
      <div className="relative m-3 rounded-lg overflow-hidden h-[62vh] min-h-[420px]" style={{ border: "1px solid var(--ttm-vien)" }}>
        <Canvas shadows dpr={[1, 2]} camera={{ position: [14, 24, 30], fov: 42 }}>
          <Suspense fallback={<Html center><div style={{ fontSize: 13, opacity: 0.7, whiteSpace: "nowrap" }}>{t("Đang dựng văn phòng…")}</div></Html>}>
            <Canh d={d} toi={toi} chon={chon} mayChon={mayChon} onMo={onMo} onChonMay={onChonMay} t={t} />
          </Suspense>
        </Canvas>
        <div className="absolute left-2 bottom-2 rounded-md px-2 py-1 text-[11px]" style={{ background: "var(--ttm-thanh)" }}>
          {t("Kéo để xoay · cuộn để phóng to · bấm người để xem máy · bấm nhãn phòng để mở phòng")}
        </div>
      </div>
    </div>
  );
}

useGLTF.preload(MO_HINH.cay);
