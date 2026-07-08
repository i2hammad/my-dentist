// Reshape Prisma rows into the Mongo-style JSON the frontend already expects.
//
//  - `serialize()` deep-copies a row/array and adds `_id` (mirroring `id`) on every
//    nested object, so the frontend's `_id` reads keep working. `id` is kept too.
//  - `remapRefs()` moves a Prisma relation object onto its Mongo FK field name
//    (e.g. `{ patient }` → `patientId: <patient object>`), reproducing `populate`.
//
// Usage in a controller:
//   const appt = await prisma.appointment.findUnique({ ..., include: { patient: true, doctor: true } });
//   ok(res, serialize(remapRefs(appt, { patient: 'patientId', doctor: 'doctorId' })));

function serialize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (value instanceof Date) return value; // res.json() emits ISO strings, same as Mongo
  if (typeof value === 'object') {
    const out = {};
    if ('id' in value) out._id = value.id;
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

// Move included relation object(s) onto their Mongo FK name. `map` is
// { relationField: fkFieldName }. When the relation wasn't included, the scalar
// FK id already lives on the FK name, so nothing to do.
function remapRefs(row, map) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const [rel, fk] of Object.entries(map)) {
    if (out[rel] !== undefined && out[rel] !== null) {
      out[fk] = out[rel];
      delete out[rel];
    }
  }
  return out;
}

// Convenience: remapRefs across an array.
function remapMany(rows, map) {
  return (rows || []).map((r) => remapRefs(r, map));
}

module.exports = { serialize, remapRefs, remapMany };
