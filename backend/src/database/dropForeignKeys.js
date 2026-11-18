// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 18/11/2026
// │ Migration step: drop every foreign key constraint and keep its index
// └──────────────────────────────────────────────────────────────────────────┘

// Constraint names differ between installs (xxx_ibfk_1), so they are read from
// the database. Dropping a constraint leaves its index in place; if a column
// somehow has no index of its own, one is added first so lookups stay fast.
// Safe to run again: with no constraints left it does nothing.
async function dropForeignKeys(connection, database) {
  const [columns] = await connection.query(
    `SELECT k.TABLE_NAME AS tableName, k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS col
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.TABLE_CONSTRAINTS c
         ON c.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME
        AND c.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND c.CONSTRAINT_TYPE = 'FOREIGN KEY'
      WHERE k.TABLE_SCHEMA = ?
      ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
    [database]
  );

  const constraints = new Map();
  for (const { tableName, name, col } of columns) {
    const key = `${tableName}\u0000${name}`;
    if (!constraints.has(key)) constraints.set(key, { tableName, name, cols: [] });
    constraints.get(key).cols.push(col);
  }

  const dropped = [];
  for (const { tableName, name, cols } of constraints.values()) {
    const [indexRows] = await connection.query(
      `SELECT INDEX_NAME AS idx, COLUMN_NAME AS col FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [database, tableName]
    );
    const indexes = new Map();
    indexRows.forEach(({ idx, col }) => indexes.set(idx, [...(indexes.get(idx) || []), col]));
    const covered = [...indexes.values()].some((c) => cols.every((col, i) => c[i] === col));

    if (!covered) {
      await connection.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`idx_${tableName}_${cols.join('_')}\` (${cols.map((c) => `\`${c}\``).join(', ')})`);
    }
    await connection.query(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${name}\``);
    dropped.push(`${tableName}.${cols.join(',')}`);
  }
  return dropped;
}

module.exports = dropForeignKeys;
