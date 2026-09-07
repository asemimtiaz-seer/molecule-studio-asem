export const elementColors: Record<string, number> = {
  H: 0xe5e9ed, C: 0x53636d, N: 0x3050f8, O: 0xff0d0d, F: 0x90e050,
  S: 0xffff30, P: 0xff8000, Cl: 0x1ff01f, Br: 0xa62929, I: 0x940094,
};
export function elementColor(element: string) {
  return "#" + (elementColors[element] ?? 0xff1493).toString(16).padStart(6, "0");
}
