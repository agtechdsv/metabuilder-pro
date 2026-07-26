export function createTunnelSupabaseClient(tunnelChannel: any, originalSupabase: any, projectToken: string) {
  if (!tunnelChannel) return originalSupabase;

  return {
    ...originalSupabase,
    from: (table: string) => {
      let currentQuery = { 
        action: '', 
        selectCols: '*', 
        filters: [] as { col: string, op: string, val: any }[], 
        orders: [] as { col: string, asc: boolean }[],
        isSingle: false,
        mutationPayload: null as any
      };

      const execute = async () => {
        const queryId = crypto.randomUUID();
        return new Promise((resolve) => {
          let sql = '';
          
          const escapeStr = (str: any) => String(str).replace(/'/g, "''");
          const formatWhere = () => {
            const validFilters = currentQuery.filters.filter(f => f.col !== 'project_id');
            if (validFilters.length === 0) return '';
            return ' WHERE ' + validFilters.map(f => {
              if (f.val === null) return `"${f.col}" IS NULL`;
              return `"${f.col}" ${f.op} '${escapeStr(f.val)}'`;
            }).join(' AND ');
          };

          if (currentQuery.action === 'select') {
             // Note: ignoring complex relations in select for now, just fallback to * if relations are detected
             let cols = currentQuery.selectCols.includes('(') ? '*' : currentQuery.selectCols;
             sql = `SELECT ${cols} FROM "${table}"`;
             sql += formatWhere();
             if (currentQuery.orders.length > 0) {
               sql += ' ORDER BY ' + currentQuery.orders.map(o => `"${o.col}" ${o.asc ? 'ASC' : 'DESC'}`).join(', ');
             }
             if (currentQuery.isSingle) {
               sql += ' LIMIT 1';
             }
          } else if (currentQuery.action === 'insert') {
             const data = Array.isArray(currentQuery.mutationPayload) ? { ...currentQuery.mutationPayload[0] } : { ...currentQuery.mutationPayload };
             if (data.project_id) delete data.project_id;
             if (Object.keys(data).length === 0) return resolve({ data: null, error: { message: 'No data to insert' } });
             const keys = Object.keys(data);
             const vals = Object.values(data);
             sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${vals.map(v => v === null ? 'NULL' : `'${escapeStr(v)}'`).join(', ')})`;
          } else if (currentQuery.action === 'update') {
             const data = { ...currentQuery.mutationPayload };
             if (data.project_id) delete data.project_id;
             if (Object.keys(data).length === 0) return resolve({ data: null, error: { message: 'No data to update' } });
             const updates = Object.keys(data).map(k => {
               const v = data[k];
               return `"${k}" = ${v === null ? 'NULL' : `'${escapeStr(v)}'`}`;
             });
             sql = `UPDATE "${table}" SET ${updates.join(', ')}`;
             sql += formatWhere();
          } else if (currentQuery.action === 'delete') {
             sql = `DELETE FROM "${table}"`;
             sql += formatWhere();
          }

          const handleResult = (payload: any) => {
            if (payload.payload?.queryId === queryId) {
               console.log(`[MetaBuilder Proxy] 📥 Received result for ${queryId}:`, payload.payload);
               try {
                 if (tunnelChannel.removeListener) {
                   tunnelChannel.removeListener(`query_result_${queryId}`, handleResult)
                   tunnelChannel.removeListener('sql_result', handleResult)
                 }
                 const bindings = tunnelChannel.bindings?.broadcast
                 if (Array.isArray(bindings)) {
                   tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
                 }
               } catch (e) {}

               clearTimeout(timeout);
               if (payload.payload?.success) {
                 let resultData = payload.payload.data || [];
                 if (currentQuery.isSingle) {
                   resultData = resultData.length > 0 ? resultData[0] : null;
                 }
                 resolve({ data: resultData, error: null });
               } else {
                 resolve({ data: null, error: { message: payload.payload?.error || 'Erro ao executar query no túnel' } });
               }
            }
          }
          
          tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
          tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult)

          console.log(`[MetaBuilder Proxy] 📨 Sending query to tunnel:`, { queryId, table, action: currentQuery.action, sql, token: projectToken || 'ai-generated' });
          tunnelChannel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload: {
              queryId,
              table,
              schemaName: 'public',
              action: currentQuery.action,
              query: sql,
              sql: sql,
              token: projectToken || 'ai-generated',
              joins: [],
              limit: 1000,
              offset: 0
            }
          });
          
          // Timeout to prevent hanging
          const timeout = setTimeout(() => {
             console.error(`[MetaBuilder Proxy] ⏱️ Timeout for queryId ${queryId}`);
             resolve({ data: null, error: { message: 'Timeout na resposta do banco local' } });
          }, 15000);
        });
      };

      const chain: any = {
        select: (cols = '*') => { currentQuery.action = 'select'; currentQuery.selectCols = cols; return chain; },
        insert: (data: any) => { currentQuery.action = 'insert'; currentQuery.mutationPayload = data; return chain; },
        update: (data: any) => { currentQuery.action = 'update'; currentQuery.mutationPayload = data; return chain; },
        delete: () => { currentQuery.action = 'delete'; return chain; },
        eq: (col: string, val: any) => { currentQuery.filters.push({ col, op: '=', val }); return chain; },
        neq: (col: string, val: any) => { currentQuery.filters.push({ col, op: '!=', val }); return chain; },
        gt: (col: string, val: any) => { currentQuery.filters.push({ col, op: '>', val }); return chain; },
        gte: (col: string, val: any) => { currentQuery.filters.push({ col, op: '>=', val }); return chain; },
        lt: (col: string, val: any) => { currentQuery.filters.push({ col, op: '<', val }); return chain; },
        lte: (col: string, val: any) => { currentQuery.filters.push({ col, op: '<=', val }); return chain; },
        order: (col: string, opts?: { ascending?: boolean }) => { currentQuery.orders.push({ col, asc: opts?.ascending !== false }); return chain; },
        single: () => { currentQuery.isSingle = true; return chain; },
        then: (onfulfilled: any, onrejected: any) => execute().then(onfulfilled, onrejected)
      };

      return chain;
    }
  };
}
