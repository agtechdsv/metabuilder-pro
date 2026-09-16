const oracledb = require('oracledb');
const CONN = { user: 'crm', password: 'admin', connectString: '192.168.0.201:1521/FREEPDB1' };
async function main() {
  let conn;
  try {
    conn = await oracledb.getConnection(CONN);
    const tables = ['EMPRESA', 'FUNCIONARIOS', 'CLIENTES'];
    for (const tbl of tables) {
      const res = await conn.execute(
        'SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE OWNER = UPPER(:1) AND TABLE_NAME = UPPER(:2) ORDER BY COLUMN_ID',
        ['CRM', tbl], { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      console.log('\n=== ' + tbl + ' (' + res.rows.length + ' cols) ===');
      res.rows.forEach(r => console.log('  ' + r.COLUMN_NAME + ' (' + r.DATA_TYPE + ')'));
    }
  } catch(e) { console.error('ERRO:', e.message); } finally { if(conn) await conn.close(); }
}
main();
