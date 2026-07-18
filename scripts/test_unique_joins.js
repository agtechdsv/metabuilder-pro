const detailsItemTitles = {
  "d33a5060-cc55-4d09-a3bc-2b68d199a09d": "produtos.nome"
};

const detailModelId = "d33a5060-cc55-4d09-a3bc-2b68d199a09d";
const join = { to: "itens_pedido" };
const subDetailJoins = [];

const detailModel = {
  fields: [
    {
      "id": "3631fc08-08b3-43fa-ae86-7d182ffe3265",
      "model_id": "d33a5060-cc55-4d09-a3bc-2b68d199a09d",
      "db_column_name": "produto_id",
      "data_type": "uuid"
    }
  ]
};

const titleField = detailsItemTitles?.[detailModelId || ''];
const titleJoins = [];

if (titleField && titleField.includes('.')) {
  const relatedTable = titleField.split('.')[0]
  const existingJoin = subDetailJoins.find((j) => j.to?.toLowerCase() === relatedTable.toLowerCase())
  if (existingJoin) {
    titleJoins.push(existingJoin)
  } else if (detailModel) {
    const linkField = detailModel.fields?.find((f) =>
      f.foreign_key_table === relatedTable ||
      f.db_column_name === `${relatedTable}_id` ||
      (relatedTable.endsWith('s') && f.db_column_name === `${relatedTable.slice(0, -1)}_id`) ||
      (relatedTable.endsWith('es') && f.db_column_name === `${relatedTable.slice(0, -2)}_id`)
    )
    if (linkField) {
      const titleJoin = {
        from: join.to,
        localKey: linkField.db_column_name,
        to: relatedTable,
        foreignKey: linkField.foreign_key_column || 'id'
      }
      subDetailJoins.push(titleJoin)
      titleJoins.push(titleJoin)
    }
  }
}

const allJoins = [...(titleJoins || []), ...(subDetailJoins || [])];
const uniqueJoins = Array.from(new Set(allJoins.map((j) => j.to))).map(to => allJoins.find((j) => j.to === to));

console.log("uniqueJoins:", JSON.stringify(uniqueJoins, null, 2));
