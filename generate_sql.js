const fs = require('fs');

const data = `
0947799f-1d21-42fc-82b8-8b7285e16df3	0c2daba9-c2f7-49ea-834c-f5c9947ff7a3	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
fee33e0b-dbd4-4cc6-978e-02c4a54bba72	0c2daba9-c2f7-49ea-834c-f5c9947ff7a3	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
bd7472fa-98cb-4a5d-9d84-37b7b7c9f888	0c2daba9-c2f7-49ea-834c-f5c9947ff7a3	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
9a1f4f6e-da57-47c9-ab49-934891402cb7	0c2daba9-c2f7-49ea-834c-f5c9947ff7a3	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
35b643db-372d-4c9f-9b1e-769cb7ef7003	0c2daba9-c2f7-49ea-834c-f5c9947ff7a3	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
b052bec6-8476-4638-ad66-0d8bf001ca40	0c2daba9-c2f7-49ea-834c-f5c9947ff7a3	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
67776786-401c-47fe-b1d7-40fcc470920c	10bc6e26-3030-4728-a6b0-5c80f13a3d5f	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
b9c50b22-35f7-4c96-a904-756045968afd	10bc6e26-3030-4728-a6b0-5c80f13a3d5f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
feeecbd5-194a-49eb-adf6-14805df250da	10bc6e26-3030-4728-a6b0-5c80f13a3d5f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
8c499c99-2a76-40e5-9c6e-855859c0f565	10bc6e26-3030-4728-a6b0-5c80f13a3d5f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
ad9b02b4-3ce5-43f3-98eb-fc4d99ced7ca	10bc6e26-3030-4728-a6b0-5c80f13a3d5f	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
3318eb1e-8344-42c0-ab36-48b0bf40cffb	10bc6e26-3030-4728-a6b0-5c80f13a3d5f	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
7886b0f5-9a38-4d6b-b9df-2b88a9562d70	11d08931-6bc8-42a9-a79f-f7f91f9473d9	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
ab8dd365-985c-477b-addc-319d186ac812	11d08931-6bc8-42a9-a79f-f7f91f9473d9	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
7e8f43e3-31da-40f0-aace-e78023637787	11d08931-6bc8-42a9-a79f-f7f91f9473d9	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
e2c926ff-489a-4430-96df-f9d8a9002684	11d08931-6bc8-42a9-a79f-f7f91f9473d9	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
f8b513b3-f6cc-45eb-99f8-8c2f9be96777	11d08931-6bc8-42a9-a79f-f7f91f9473d9	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
e3a4e8e5-8d23-4013-9412-a24b85e4d6aa	11d08931-6bc8-42a9-a79f-f7f91f9473d9	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
f8231b15-9b83-44c5-969c-d1f92f598654	11e712dc-782b-4ab4-9a35-19cefc93ee0d	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
12d11dac-d984-4366-a5b9-20491d12264a	11e712dc-782b-4ab4-9a35-19cefc93ee0d	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
1ba41a28-d2d8-4860-be24-5cb4f97776f1	11e712dc-782b-4ab4-9a35-19cefc93ee0d	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
bf87cb17-e6a5-45a5-86ae-22729a86bdde	11e712dc-782b-4ab4-9a35-19cefc93ee0d	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
b4a76ff5-f0d8-45bc-afc6-1ac59ca4738e	11e712dc-782b-4ab4-9a35-19cefc93ee0d	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
2bf99aa4-8b3b-4815-a233-5ce33c25298e	11e712dc-782b-4ab4-9a35-19cefc93ee0d	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
91606739-d264-4528-9ceb-f59af998779e	4ea8f696-4503-4152-ba3a-5312fe34a71e	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
e7a7deb3-6500-417b-ae96-a22ace1bf1ef	4ea8f696-4503-4152-ba3a-5312fe34a71e	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
aaaf800e-ad09-4d31-9fbc-a0eb0828eab7	4ea8f696-4503-4152-ba3a-5312fe34a71e	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
e9c0f4a5-9a2f-450c-83b6-4e05564ee6b1	4ea8f696-4503-4152-ba3a-5312fe34a71e	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
3e7a159d-1c1f-4bc3-bc5b-c4be887b4914	4ea8f696-4503-4152-ba3a-5312fe34a71e	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
58775fed-c70d-4c97-8a7c-c92905804ee3	4ea8f696-4503-4152-ba3a-5312fe34a71e	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
bc82cb2d-ba69-4337-bd48-74da0b22086c	6d4113bf-cb2d-48ed-aa3d-cbb2fb38fb9a	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
1b2dde71-d166-4a11-9207-e297c8591821	6d4113bf-cb2d-48ed-aa3d-cbb2fb38fb9a	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
f9161709-3d55-4332-8cd0-8a62391d36e0	6d4113bf-cb2d-48ed-aa3d-cbb2fb38fb9a	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
01b22cce-fcf4-4cdd-aa4a-d916fcabe333	6d4113bf-cb2d-48ed-aa3d-cbb2fb38fb9a	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
61b512a3-7eff-4644-a95e-9dc37c343664	6d4113bf-cb2d-48ed-aa3d-cbb2fb38fb9a	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
7fa12f84-8c79-4cdd-8264-e4b7fc19a3b6	6d4113bf-cb2d-48ed-aa3d-cbb2fb38fb9a	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
36f87e15-4a23-43ab-aba7-354eddf13ac5	72d32eff-8d7c-4318-8257-86e24532c20f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
7dfd879b-dae2-429e-80fd-049214f81aa1	72d32eff-8d7c-4318-8257-86e24532c20f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
55978b69-0d3d-4675-a97e-4ba1654e2509	72d32eff-8d7c-4318-8257-86e24532c20f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
416fa652-f2ca-4bc2-8482-8eef7ce62675	72d32eff-8d7c-4318-8257-86e24532c20f	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
a672535b-ca04-4f05-8293-08f38040048f	72d32eff-8d7c-4318-8257-86e24532c20f	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
58352d8f-0377-481c-bf6e-63452be8afc9	72d32eff-8d7c-4318-8257-86e24532c20f	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
b3508bff-4781-44a0-9ca1-cfaed923821d	8e5da72a-4324-4cd3-a4ac-6d58e4cbb81c	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
2031cd41-d072-4ae2-ae45-bff3daa4ab46	8e5da72a-4324-4cd3-a4ac-6d58e4cbb81c	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
d1145fdf-f6f7-43e9-9283-868b4e8c887a	8e5da72a-4324-4cd3-a4ac-6d58e4cbb81c	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
2b6a262c-3a2d-414f-b30e-ce7b888f62aa	8e5da72a-4324-4cd3-a4ac-6d58e4cbb81c	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
381a9307-97df-4aaa-ba87-767536d51d50	8e5da72a-4324-4cd3-a4ac-6d58e4cbb81c	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
0fd19097-a642-48a4-aa7f-492db5ab20f1	8e5da72a-4324-4cd3-a4ac-6d58e4cbb81c	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
4db68bdc-c6b1-43e6-b5d9-9574eb77a6bd	922768ab-64c9-495a-a49e-cfbb3fd899c8	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
64a7238b-8dc7-4487-b20f-1e02a6f9835e	922768ab-64c9-495a-a49e-cfbb3fd899c8	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
3f43b5bd-cab6-4b26-8b44-f2d4af4e1070	922768ab-64c9-495a-a49e-cfbb3fd899c8	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
4d8813cf-7860-4d74-a453-7ef8e483fe15	922768ab-64c9-495a-a49e-cfbb3fd899c8	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
a769628a-5269-454f-bf05-f5c0e33ca7d5	922768ab-64c9-495a-a49e-cfbb3fd899c8	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
d7fb549d-d3de-4866-8c00-970a5cf05d7e	922768ab-64c9-495a-a49e-cfbb3fd899c8	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
e9ee1086-9177-44e1-81e9-7cb4fc54a8d2	a53941e5-cc94-45f0-b70f-8ae55536a01e	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
6e434481-0deb-448b-b473-5f8f074479ea	a53941e5-cc94-45f0-b70f-8ae55536a01e	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
4668c78d-68db-4ed6-be99-de81037e8d54	a53941e5-cc94-45f0-b70f-8ae55536a01e	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
22cf5d48-a2b4-4497-9e17-bacb14de5e43	a53941e5-cc94-45f0-b70f-8ae55536a01e	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
58545edf-b5a7-4c04-a1fa-42574a20de2a	a53941e5-cc94-45f0-b70f-8ae55536a01e	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
11307741-3471-4733-8663-dc275eecb270	a53941e5-cc94-45f0-b70f-8ae55536a01e	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
bb14f40e-d8af-4c59-84b1-adeb4bf20dc7	c154bc4c-12f0-48f6-9b00-0040fb23b6b2	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
46e048f6-7d1d-430a-a8cf-5d83d863b9a6	c154bc4c-12f0-48f6-9b00-0040fb23b6b2	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
305d3ccf-2f58-490b-a374-6e32bea5f055	c154bc4c-12f0-48f6-9b00-0040fb23b6b2	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
1f1570ac-4a5d-4e8e-ab49-145e8f68fa1c	c154bc4c-12f0-48f6-9b00-0040fb23b6b2	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
c6034dac-6887-4fa0-86c2-403ca0f7b88c	c154bc4c-12f0-48f6-9b00-0040fb23b6b2	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
6fed9059-ff40-4a9e-88a4-59515271f55d	c154bc4c-12f0-48f6-9b00-0040fb23b6b2	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
bb118c25-5378-4005-9ee4-ebe4cd620170	d0b0035a-d955-4045-8891-e15377fd1d23	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
654dad64-89b8-4db7-add8-ca821756bdf5	d0b0035a-d955-4045-8891-e15377fd1d23	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
50a507b2-51f7-4599-8114-4295950730dc	d0b0035a-d955-4045-8891-e15377fd1d23	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
2999832d-2590-4fa2-949a-18c0e5e1643c	d0b0035a-d955-4045-8891-e15377fd1d23	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
fbda8b14-46a9-4ce5-8a0c-e35f08afe805	d0b0035a-d955-4045-8891-e15377fd1d23	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
29f10078-e66e-4c05-9c01-e6058b83b747	d0b0035a-d955-4045-8891-e15377fd1d23	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
17d27965-8e02-4ffd-977f-48f69213f401	d552ab66-0e65-4286-aa4f-4ed46aaecb49	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
f66d8d24-20c2-4c97-afb4-cccddf919eb4	d552ab66-0e65-4286-aa4f-4ed46aaecb49	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
1d20e7f3-15ae-4c4e-8f93-f71aa50d6cf4	d552ab66-0e65-4286-aa4f-4ed46aaecb49	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
a2836055-9d52-4e7b-9241-d8eca59bcf27	d552ab66-0e65-4286-aa4f-4ed46aaecb49	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
7656a39f-a511-4b92-a971-62322ca782c4	d552ab66-0e65-4286-aa4f-4ed46aaecb49	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
4048ff92-fdf4-46cb-ba28-12d8d56f58ee	d552ab66-0e65-4286-aa4f-4ed46aaecb49	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
3f555fdc-7953-46cd-99cd-b0fdaf9d857f	e5c605b6-5dc4-41f3-98e5-54d873c9b8e0	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
12dbaaec-d096-439b-a554-cac24db40ed6	e5c605b6-5dc4-41f3-98e5-54d873c9b8e0	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
40b26aa5-dfed-428f-b204-5f1b22398a1c	e5c605b6-5dc4-41f3-98e5-54d873c9b8e0	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
01a97704-ac07-4086-9dc4-e08b24f2c622	e5c605b6-5dc4-41f3-98e5-54d873c9b8e0	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
22a24fe7-f0e4-485e-94a4-20e6a08343a8	e5c605b6-5dc4-41f3-98e5-54d873c9b8e0	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
9434662f-22c2-42d0-a3dc-2cb9ee47d748	e5c605b6-5dc4-41f3-98e5-54d873c9b8e0	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
f7c6d8f8-9d70-4b97-bbf2-45ba63ca50fe	f78424f5-b6e0-4f9a-9051-2f80169f686f	8b8de4fa-0a60-4819-a5a4-14a8fe4a7081	Levantamento de Requisitos
27d9fde4-2405-4a9f-a9e6-fe5c106a33b2	f78424f5-b6e0-4f9a-9051-2f80169f686f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Revisão Pós-Implantação
b40bafd8-a53f-4b15-8557-9767ecb2b8ea	f78424f5-b6e0-4f9a-9051-2f80169f686f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Treinamento de Usuários
56d53f01-e3bb-4421-9432-d471e5bd328e	f78424f5-b6e0-4f9a-9051-2f80169f686f	3431c6e5-045f-4d86-9a2a-4787e9fed4e8	Logística de Entrega
3db1656c-2e48-4150-be50-380a96724775	f78424f5-b6e0-4f9a-9051-2f80169f686f	50417ebf-cc1c-4353-8cd5-b2998beb84b8	Instalação de Equipamentos
4eb3ff00-3c13-441a-9b13-2f1fb1187397	f78424f5-b6e0-4f9a-9051-2f80169f686f	302c3587-c869-4ba3-8e65-1fb3cb6602d2	Reunião Inicial (Kickoff)
`;

const lines = data.trim().split('\n');
const projects = {};

const order = [
  'Reunião Inicial (Kickoff)',
  'Levantamento de Requisitos',
  'Instalação de Equipamentos',
  'Logística de Entrega',
  'Treinamento de Usuários',
  'Revisão Pós-Implantação'
];

lines.forEach(line => {
  const parts = line.split('\t');
  if (parts.length < 4) return;
  const id = parts[0];
  const projectId = parts[1];
  const title = parts[3];

  if (!projects[projectId]) {
    projects[projectId] = {};
  }
  projects[projectId][title] = id;
});

let sql = '';
for (const pId in projects) {
  const t = projects[pId];
  if (t[order[0]] && t[order[1]]) sql += `UPDATE tarefas SET tarefa_antecessora_id = '${t[order[0]]}' WHERE id = '${t[order[1]]}';\n`;
  if (t[order[1]] && t[order[2]]) sql += `UPDATE tarefas SET tarefa_antecessora_id = '${t[order[1]]}' WHERE id = '${t[order[2]]}';\n`;
  if (t[order[2]] && t[order[3]]) sql += `UPDATE tarefas SET tarefa_antecessora_id = '${t[order[2]]}' WHERE id = '${t[order[3]]}';\n`;
  if (t[order[3]] && t[order[4]]) sql += `UPDATE tarefas SET tarefa_antecessora_id = '${t[order[3]]}' WHERE id = '${t[order[4]]}';\n`;
  if (t[order[4]] && t[order[5]]) sql += `UPDATE tarefas SET tarefa_antecessora_id = '${t[order[4]]}' WHERE id = '${t[order[5]]}';\n`;
}

fs.writeFileSync('update_tarefas.sql', sql);
console.log('Written to update_tarefas.sql');
