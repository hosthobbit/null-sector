// Circle-vs-grid collision with wall sliding (x and z resolved separately).
export function moveCircle(pos, dx, dz, radius, level) {
  const blocked = (x, z) =>
    level.isSolid(x - radius, z - radius) || level.isSolid(x + radius, z - radius) ||
    level.isSolid(x - radius, z + radius) || level.isSolid(x + radius, z + radius);
  let hitX = false, hitZ = false;
  if (!blocked(pos.x + dx, pos.z)) pos.x += dx; else hitX = true;
  if (!blocked(pos.x, pos.z + dz)) pos.z += dz; else hitZ = true;
  return hitX || hitZ;
}
