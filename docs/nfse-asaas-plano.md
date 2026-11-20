# Emissão de NFS-e do MetaBuilderPRO pelo Asaas: análise, plano, configuração e testes

Versão de 18/11/2026 (3ª versão). Decisões do dono: testes direto em **produção**; decisão sobre o regime de IBS/CBS até **27/11/2026**. Novidade desta versão: o **alvará de localização e funcionamento (ALF) do endereço novo foi emitido em 17/11/2026** e o CNAE 6203-1/00 está admitido no cadastro municipal. Só análise e planejamento: **nada foi codado**. Onde algo não foi verificado em fonte oficial, está escrito.

Relacionados: `docs/fiscal/` (leiautes e manuais oficiais da NFS-e Nacional), `docs/avisos-cobranca.md`, `docs/roteiro-teste-pagamento-assinatura.md`.

---

## 1. Resumo: onde vamos terminar

**Estado final desejado.** O cliente paga a assinatura (cartão, Pix ou boleto, pelo Asaas) e usa o sistema. Passado o prazo de arrependimento (7 dias, mais 1 de folga) e **só se o pagamento continuar válido** (sem estorno, sem cancelamento), o MetaBuilder pede ao Asaas a emissão da NFS-e, o Asaas a emite no Portal Nacional com o seu certificado A1, e o cliente recebe a nota por e-mail (PDF e link), pelo nosso Gerenciador de e-mails. Tudo aparece num painel "Fiscal" do SuperAdmin, com uma tela de **Configuração fiscal** e um interruptor de modos (desligado, teste sem envio, revisão, automático).

**O que já está resolvido**
- A alteração contratual foi **registrada na JUCEMG em 17/11/2026** (registro nº 14357462, efeitos retroativos a 12/11/2026). O objeto social agora inclui "desenvolvimento e licenciamento de programas de computador não customizáveis".
- O **cartão do CNPJ já mostra o CNAE 62.03-1-00** (secundário), com o novo endereço, porte ME, situação ativa. A Receita já refletiu a mudança.
- O Asaas **emite NFS-e pela API** (agendar, antecipar, cancelar, webhooks) e, para o Simples Nacional, a emissão passou a ser **pelo Portal Nacional desde 1º/11/2026**; aceita certificado A1.
- **Alvará da PBH emitido (17/11/2026):** nº 2026044693, **Ativo, válido até 17/11/2031**, no endereço novo, com **6203-1/00 admitido** (e 6209-1/00 e 6201-5/01). Inscrição Municipal 0.933.007/001-4. A consulta pública mostra o alvará antigo como **Substituído**.
- **Endereço novo já aparece no Emissor Nacional** ("Exibir detalhes do emitente").
- A **viabilidade** (MGP2601108917) está **admitida**, "liberado por se tratar de residência do titular" (Lei 11.181/19, art. 177, II).

**Quadro de andamento**

| Item | Situação |
|---|---|
| Alteração contratual na Junta | Feito (17/11) |
| CNPJ com CNAE 62.03-1-00 e endereço novo | Feito |
| Viabilidade e alvará da PBH | **Feito (17/11)** |
| Endereço novo no Emissor Nacional | Feito |
| Conferir se a inscrição municipal 0.933.007/001-4 é a que o Emissor Nacional e o Asaas usam | Pendente (rápido) |
| Taxa anual da PBH (TFLF): valor e vencimento (10 de maio) | Pendente (ver com o contador ou no Sistema de Emissão de Guias) |
| Mensagem ao contador (9 perguntas, seção 3.1) | **Enviada; respondida em 18/11 (seção 3.5).** Faltam: plano anual (pergunta repetida, aguardando), e por telefone tributação, IRRF/INSS, exterior e cancelamento em chargeback. Checagem no Asaas feita em 19/11 (protocolo 2068696): **não aceita competência separada**, a competência é a data da emissão |
| Decisão do regime de IBS/CBS | Pendente, **até 27/11/2026** |
| Configuração do Asaas em produção (seção 6) | Pendente |
| Implementação (seção 5) | Não iniciada |
| Testes em produção (seção 7) | Depois da implementação |

**O que ainda precisa de decisão ou ação (seções 3 e 6)**
1. **Perguntas ao contador** (regime de IBS/CBS até 27/11, competência, retenção de ISS, NBS/cClassTrib oficiais). Há uma mensagem pronta na seção 3.1.
2. **Pequenas conferências do alvará** (inscrição municipal no Emissor Nacional e no Asaas; guardar cópia afixável; taxa anual).
3. **Configurar o Asaas direto em produção** (seção 6), com salvaguardas.
4. Só depois, a implementação (seção 5).

**Correções ao texto do Gemini (seção 2).** O resultado geral está bem encaminhado, mas há um código a esclarecer (indicador da operação), um item de privacidade (e-mail do cliente na descrição) e dois itens que ele deixou de fora e que mudam o preenchimento (alíquota do ISS no Simples e retenções).

---

## 2. O que li e a análise

### 2.1 PDFs da empresa (fatos relevantes para a nota)

| Fato | Valor | Efeito na emissão |
|---|---|---|
| Razão social / CNPJ | AG TECH SERVICOS INFORMATICA LTDA, 19.287.384/0001-01 | Prestador da nota |
| Porte / natureza | ME, sociedade empresária limitada (sócio único) | Simples Nacional |
| CNAE principal | 62.01-5-01 desenvolvimento de programas sob encomenda | Segue principal |
| CNAE secundários | **62.03-1-00 desenvolvimento e licenciamento de programas não customizáveis**, 62.09-1-00, 85.99-6-04 | 62.03-1-00 sustenta o item 01.05 (licenciamento) |
| Endereço da sede | Rua José Hemetério de Andrade, 390, apto 202, Buritis, Belo Horizonte/MG, CEP 30493-180 (mesmo endereço de residência do sócio) | Mudou: atualizar Prefeitura, Portal Nacional e Asaas |
| Registro na Junta | nº 14357462 em 17/11/2026; efeitos de 12/11/2026; protocolo 26/787.476-6 | Habilita vender o licenciamento |
| Objeto social | Inclui licenciamento de programas não customizáveis, desenvolvimento sob encomenda, treinamento, suporte | OK para vender assinaturas |

Observações:
- O endereço de sede é residencial (apartamento). Se a Prefeitura exigir algo para esse endereço (viabilidade, alvará), isso corre fora do sistema; os documentos de viabilidade e REDESIM da sua pasta não foram abertos por mim.
- O ISS do subitem 1.05 é devido em Belo Horizonte (ver 2.2).

### 2.2 Texto do Gemini: veredito, campo a campo

| Item | O que o Gemini disse | Veredito | Comentário |
|---|---|---|---|
| Código de Tributação Nacional | 01.05.01 | **Correto** | Subitem 1.05 da LC 116: "Licenciamento ou cessão de direito de uso de programas de computação". Para assinatura de software (SaaS) há municípios que a tratam como 1.03; o contador e a PBH já indicaram 1.05.01 para o MetaBuilder. Deixar configurável. No XML esse código aparece como `010501` (6 dígitos). |
| Código municipal | 01.05.01.001 (habilitado pela PBH) | **Plausível** | A tela aceitar o código é um bom sinal; não prova que a PBH já "sincronizou" o CNAE. Confirmar no cadastro municipal. |
| Item da NBS | 111032200 (1.1103.22.00) | **Provavelmente correto** | Fontes secundárias descrevem 1.1103.22.00 como "licenciamento de direitos de uso de programas de computador (software)" e 1.1103.21.00 como direitos de produção/distribuição/comercialização. **Não confirmei na tabela oficial NBS/Anexo VIII** (não está em `docs/fiscal/`). Confirmar antes de produção. |
| Município de incidência do ISS | Belo Horizonte (prestador) | **Correto** | Li o art. 3º da LC 116/2003: nenhum inciso (I a XXV) cita o subitem 1.05; vale a regra geral, estabelecimento do prestador. Os incisos que levam o ISS para o domicílio do tomador (XXIII a XXV) cobrem só os subitens 4.22, 4.23, 5.09, 15.01 e 15.09. |
| Código indicador da operação | **100501, "operação vinculada ao item 01.05"** | **Explicação errada; o código precisa ser conferido** | No Anexo C oficial (`docs/fiscal/anexo-c-indop-ibscbs-snnfse-v1-01.xlsx`), 100501 é "**Demais bens móveis imateriais, inclusive direitos, em operações onerosas**" (local da operação para IBS/CBS = domicílio do adquirente). Não existe vínculo com o item 01.05. A ideia de que seria **010501** parece confusão com o **código de tributação nacional 01.05.01** (que no XML é `010501`): são campos diferentes. Procurei `010501` no Anexo C inteiro e **ele não existe como indicador da operação**; os códigos da tabela são 020101, 020201, 020301, 030101 a 030104, 040101, 050101 a 050104, 050201, 060101, 070101, 070102, 080101, 100101, 100102, 100201, 100301, 100302, 100401, 100501, 100502, 100601. Para software, os candidatos são **100501** (bens imateriais/direitos) e **100301** ("demais serviços"); a escolha vem da tabela oficial de correlação NBS x indOp, a confirmar com o contador. **Atualização (17/11):** perguntado de novo, o próprio Gemini corrigiu: o certo para licenciamento/SaaS é **100301** ("demais serviços", serviço prestado à distância, local = domicílio do adquirente), e o "05" do 100501 foi confusão com o item 01.05. Isso bate com a tabela oficial (100301 = "Demais serviços, em operações onerosas"). Ele também diz que, em 2026, o optante do Simples fica **dispensado** de preencher IBS/CBS (cIndOp e cClassTrib) e o emissor oculta o campo: coerente com o que achei (ausência não rejeita até 31/12/2026, destaque obrigatório para o Simples em 2027), **mas vale só enquanto você estiver no Simples puro**: se mantiver a adesão ao regime regular de IBS/CBS (decisão até 27/11), os campos entram. |
| cClassTrib | 000001 "tributado integralmente" | **Não confirmado** | Não consegui confirmar na fonte oficial qual cClassTrib vale para prestador **optante pelo Simples**. Em 2026 a ausência de IBS/CBS não rejeita a nota até 31/12/2026 (segundo fonte secundária, Ato Conjunto RFB/CGIBS nº 4/2026); para optantes do Simples, o destaque passa a valer em 1º/1/2027. |
| Operação tributável, não retido | "salvo órgão público" | **Incompleto** | A retenção de ISS pelo tomador depende de lei municipal e do tomador. Ver 3.2. |
| Alíquota do ISS | **não tratou** | **Faltou** | Há regra oficial no leiaute: ver 3.2. |
| Retenções federais | **não tratou** | **Faltou** | PIS, COFINS e CSLL **não são permitidos para optante do Simples** na API do Asaas. IRRF e INSS: confirmar com o contador. |
| Descrição do serviço | "Licenciamento de direito de uso do Sistema MetaBuilderPRO – Plano [Mensal/Anual] – Período de [MM/AAAA]" | **Boa, com ajustes** | Faltam os ciclos **trimestral e semestral** (o checkout os tem) e o período final nos planos longos ("11/2026 a 10/2027"). |
| "Conta licenciada: [e-mail do cliente]" | sugestão opcional | **Não recomendo** | Dado pessoal em documento fiscal e em página de consulta. O tomador (CPF/CNPJ) já está na nota. Se quiser identificar, use uma referência curta do pagamento. |
| Chave Pix / dados bancários na descrição | sugestão opcional | **Não recomendo** | A nota sai **depois** do pagamento (não há o que cobrar), e chave Pix num documento fiscal só abre espaço para golpe. |
| "Forma de pagamento / vencimento" | opcional | **Opcional** | Como a emissão é após o pagamento, "Pago via Pix em DD/MM/AAAA" é verdadeiro e ajuda a conciliação do cliente. |

### 2.3 O que o Asaas oferece (verificado na documentação deles; **não executei nenhuma chamada**)

- **Preço:** R$ 0,49 por NFS-e emitida; agendamento e cancelamento gratuitos (página comercial); conferir no seu contrato.
- **Portal Nacional:** desde 1º/11/2026 as ME/EPP do Simples emitem pelo Emissor Nacional; no Asaas, a autenticação é **certificado A1 (opcional, mais estável) ou usuário e senha**. No Portal Nacional, a API usa `municipalServiceCode` (não `municipalServiceId`).
- **API:** `POST /v3/invoices` agenda a nota (origem: `payment`, `installment` ou `customer`; campos `serviceDescription`, `observations`, `value`, `deductions`, `effectiveDate`, `municipalServiceCode`, `municipalServiceName`, `taxes`). `POST /v3/invoices/{id}/authorize` antecipa uma nota agendada; `PUT /v3/invoices/{id}` altera enquanto `SCHEDULED` ou `ERROR`; `POST /v3/invoices/{id}/cancel` pede o cancelamento (depende da prefeitura). Status: `SCHEDULED`, `AUTHORIZED`, `PROCESSING_CANCELLATION`, `CANCELED`, `CANCELLATION_DENIED`, `ERROR`.
- **Campos da Reforma Tributária em `taxes`:** `nbsCode`, `taxSituationCode`, `taxClassificationCode`, `operationIndicatorCode`, `federalServiceTaxCode`. Valores de IBS/CBS vêm só na resposta (o Asaas calcula). Os formatos exatos (ex.: NBS com ou sem pontos) **só se confirmam na primeira emissão**.
- **Webhooks de nota:** `INVOICE_AUTHORIZED`, `INVOICE_ERROR`, `INVOICE_PROCESSING_CANCELLATION`, `INVOICE_CANCELED`, `INVOICE_CANCELLATION_DENIED`. Após autorizar: `pdfUrl`, `xmlUrl`, `number`, `validationCode`.
- **E-mail:** a página comercial diz que o Asaas envia a nota ao cliente por e-mail. Como nós já controlamos os e-mails de cobrança (e desligamos as notificações do Asaas por custo), recomendo **enviar a nota pelo nosso Gerenciador de e-mails** (seção 5.5).
- **Cadastro do tomador:** o Asaas exige o cadastro completo do pagador (CPF/CNPJ e endereço). O nosso checkout já coleta `cpfCnpj`, CEP e número.

---

## 3. Contador

### 3.1 Mensagem pronta para enviar

> Olá, [nome]. Vou começar a vender assinaturas do MetaBuilderPRO (licenciamento de uso de software, CNAE 6203-1/00, item 01.05.01 da LC 116), cobradas por cartão, Pix ou boleto pelo Asaas. Por causa do direito de arrependimento de 7 dias do consumidor, a nota só será emitida **8 dias depois da confirmação do pagamento**, e só se o cliente não tiver pedido reembolso. Exemplos: o cliente paga em 28/11 e a nota sai em 06/12; o cliente paga em 25/12 e a nota sai em 02/01. Preciso de resposta para:
>
> 1. **Competência e receita.** No Simples, a receita desse pagamento entra no PGDAS-D do mês do **recebimento** (regime de caixa) ou do mês da **nota** (competência)? Qual regime eu uso hoje?
> 2. Uma NFS-e emitida no mês **seguinte** ao do recebimento é aceita pela PBH? Há prazo máximo para emitir?
> 3. A data de **competência** da nota pode ser o mês do pagamento (anterior à emissão) ou tem de ser a do mês da emissão? Qual você recomenda?
> 4. Plano **anual, semestral ou trimestral** pago de uma vez: uma nota única pelo valor total, no mês do recebimento, está correta ou deve ser fracionada por mês de uso?
> 5. **Retenção de ISS:** clientes pessoa jurídica em Belo Horizonte e em outros municípios devem reter o ISS desse serviço? E retenções federais (PIS, COFINS, CSLL, IRRF, INSS) sendo eu optante do Simples?
> 6. Qual **código NBS** e qual **indicador da operação** (e cClassTrib) devo usar na nota do 01.05.01: 111032200 e 100301?
> 7. **Regime de IBS/CBS:** tenho de decidir até 27/11 se mantenho a adesão ao regime regular ou cancelo. O que muda para mim na nota e no recolhimento em cada caso?
> 8. **Chargeback de cartão** (o cliente contesta a compra com o banco depois da nota emitida e o dinheiro volta): cancelo a NFS-e? Até quando isso é possível? Como fica o DAS que já paguei sobre essa receita?
> 9. Atendo clientes **no exterior**? Se sim, a nota tem outro tratamento (exportação)?

### 3.2 Alíquota do ISS e retenções: o que o Asaas sabe e o que você informa

Li as regras oficiais do leiaute da DPS (`docs/fiscal/anexo_i-...xlsx`) para prestador **ME/EPP optante do Simples com ISS apurado pelo Simples**:

- **Sem retenção de ISS:** informar alíquota **não é permitido** (a nota é rejeitada, erro E0625). O Sistema Nacional **parametriza a alíquota** do município e preenche sozinho.
- **Com retenção de ISS** (o cliente retém): informar a alíquota passa a ser **obrigatório** (erro E0621 se faltar), entre **1,8% e 5%** (nunca acima de 5%).
- O campo `pTotTribSN` (percentual aproximado dos tributos do Simples, para o cliente) é informativo.

O que isso significa na prática:
- **Caso comum (sem retenção, ex.: pessoa física):** não há alíquota para você informar nem para o contador passar todo mês. O Emissor Nacional resolve.
- **Retenção:** só aparece com tomador que retém (em geral PJ). Aí você informa uma alíquota, que vem do contador e muda **raramente**, não todo mês. Como é o caso raro, a proposta é: **todo tomador pessoa jurídica fica em revisão** (um clique do admin) até o contador definir a regra de retenção.
- **Não sei como o Asaas traduz o campo `taxes.iss`**, que o esquema da API chama de obrigatório, para o caso "Simples sem retenção" (onde a regra oficial proíbe alíquota). Isso só se descobre na primeira emissão (ver 7.2); a hipótese é que ele não envie a alíquota quando não há retenção.
- **Existe fonte automática?** A alíquota efetiva do Simples sai do PGDAS-D (depende da receita dos últimos 12 meses de **toda a empresa**, não só do MetaBuilder) e não há API pública para isso. Hoje o nosso sistema só conhece a receita do MetaBuilder. Dá para **estimar** se você cadastrar a receita bruta dos últimos 12 meses (12 totais mensais bastam, não precisa de cada nota) e o sistema somar a do MetaBuilder: ver a **Fase 8 (opcional)**. Enquanto isso, guardar a alíquota na tela de configuração (6, Fase 6) com data de vigência e um lembrete.

### 3.3 Competência: minha sugestão

- A nota só pode sair 8 dias depois, então ela cai **no mesmo mês do pagamento na maioria dos casos** e no mês seguinte só quando o pagamento é feito nos últimos 7 dias do mês.
- **Sugestão:** (1) aceitar a competência como o **mês da emissão** (o padrão provável do Asaas, que a API não deixa escolher); (2) perguntar ao **suporte do Asaas** se a competência pode ser informada separada da data de emissão; (3) se o contador disser que a receita vale pelo **recebimento** (caixa), o descompasso é pequeno e só acontece nas viradas de mês; um relatório "pagos x notas" por mês resolve a conciliação.
- **Evitar:** emitir a nota no ato do pagamento só para "fechar o mês": perde a proteção do arrependimento e obriga a cancelar nota a cada reembolso.
- A decisão final é do contador (perguntas 1 a 4 da mensagem). **Respondido em 18/11: ver 3.5** (vale a competência, não existe caixa no Simples; a sugestão acima sobre "caixa" ficou superada e a pendência é a competência das notas dos últimos 7 dias do mês).

### 3.5 Respostas do contador (18/11/2026, por WhatsApp)

Numeração dele, que segue a da mensagem 3.1 (o 3 e o 2 vieram juntos):

| Pergunta | Resposta do contador (resumo fiel) | O que muda no plano |
|---|---|---|
| 1. Competência e receita | **Não existe mais regime de caixa para o Simples Nacional**; vale a **competência**. | A receita entra no mês da **competência**, não do recebimento. |
| 2 e 3. Nota fora do mês / data de competência | O correto é **nota por competência**: o uso de outubro é emitido em outubro (**antes** do pagamento, se pós-pago). Vincular a nota ao pagamento **não é o correto**, mas é o que **mais acontece**. | Ver "Impacto" abaixo. |
| 4. Plano anual/semestral/trimestral pago de uma vez: nota única pelo total, no mês do recebimento, ou fracionada por mês de uso? | "Se não houver possibilidade de cancelamento com ressarcimento, faz uma **única nota** fechando com o pagamento." | **A resposta não corresponde à pergunta** (fala de cancelamento com ressarcimento, que é assunto de chargeback/reembolso). **Não usar como resposta.** O dono **perguntou de novo** ao contador; aguardando. |
| 5. Retenção de ISS | Reter ISS **somente se o cliente for de BH e obrigado a reter** (**tem de perguntar ao cliente**). | A retenção é **exceção**: só tomador PJ de BH obrigado a reter. Reforça "PJ fica em revisão". Precisamos de um campo/pergunta "o tomador é obrigado a reter ISS?". Retenções federais (PIS, COFINS, CSLL, IRRF, INSS): **sem resposta**; PIS/COFINS/CSLL já são proibidas para o Simples na API. |
| 6. NBS, indicador da operação, cClassTrib | "Essa questão da tributação vale uma **conversa à parte, por telefone**." | **Pendente.** Seguir com 111032200 / 100301 / 01.05.01 como hipótese e confirmar na ligação. |
| 7. Regime de IBS/CBS (prazo 27/11) | **Sim, poderá desistir daquela opção.** | Decisão por **desistir (cancelar a adesão ao regime regular)**, a confirmar na ligação **antes de 27/11**. |
| 8. Chargeback e DAS | O **DAS vence dia 20 do mês seguinte**, então a questão **se resolve antes**; se o pagamento acontecer (e o dinheiro voltar depois), **podemos compensar ou ressarcir**. | Cancelar a NFS-e continua sendo a nossa parte técnica; o DAS pago a mais é **compensado ou restituído** pelo contador. |
| 9. Clientes no exterior | **Sem resposta.** | Seguir sem tratar exportação; perguntar na ligação. |

**Impacto da resposta 2 e 3 (a decisão que ainda é nossa):** o contador diz que o **ideal** é a nota **no mês da competência**, e que ligar a nota ao pagamento **não é o correto, embora seja o comum**. O nosso fluxo emite a nota **8 dias depois do pagamento**, o que fica **no mês do pagamento** na maioria dos casos e **no mês seguinte** quando o pagamento ocorre nos últimos 7 dias do mês. Isso leva a:
- Como a assinatura é **pré-paga** (o cliente paga e usa no período seguinte), a competência da **nota** deve ser a do **mês do pagamento** (início do uso) e não a do mês da emissão. **Se o Asaas não deixar informar a competência separada** da emissão (pergunta ao suporte, ver 3.3), as notas dos pagamentos dos **últimos 7 dias do mês** sairão com competência do mês seguinte. **Levar isto ao contador na ligação** e perguntar se é aceitável (é o mesmo descompasso que ele chamou de "o que mais acontece") ou se ele prefere emitir **no ato do pagamento** nesses casos.
- A hipótese "mês da emissão" da seção 3.3 **fica como plano B**, e a premissa "caixa" que ela citava **deixa de valer** (não existe caixa no Simples).
- **Resposta 4 (correção):** a pergunta era sobre **plano anual, semestral ou trimestral** e a resposta do contador **não tem relação com ela**. Fica **sem resposta**; o dono já **repetiu a pergunta** a ele. Até chegar, nada se implementa sobre planos longos (a hipótese de trabalho continua sendo uma nota única pelo total, sem confirmação).
- **Chargeback:** vale a resposta 8 (DAS vence dia 20; compensar ou ressarcir). Se a PBH permite cancelar a nota nesse caso continua **a perguntar**.
- **Competência separada da emissão:** primeiro **checar se o Asaas aceita** informar a competência separada da data de emissão (suporte do Asaas, ver 3.3). **Se aceitar**, o problema do fim de mês some. **Se não aceitar**, o assunto volta a ser debatido (opções: aceitar a competência do mês seguinte ou emitir no ato do pagamento nesses casos).
- **Combinado pelo dono:** a tributação (NBS, indicador, cClassTrib) e os itens sem resposta (IRRF/INSS, exterior) serão tratados **por telefone**, de propósito.

**Lista para a ligação com o contador:** (a) NBS, indicador da operação e cClassTrib; (b) regime de IBS/CBS (confirmar a desistência até 27/11); (c) IRRF e INSS; (d) clientes no exterior; (e) competência da nota de pagamentos nos últimos 7 dias do mês (**o Asaas não aceita competência separada**, confirmado em 19/11: emitir até o último dia do mês e cancelar se houver desistência, ou aceitar a competência do mês seguinte? ver 3.6); (f) plano anual/semestral/trimestral (nota única ou por mês de uso?), **se a nova resposta não vier por escrito**; (g) se a PBH permite cancelar a nota em caso de chargeback.

### 3.6 Competência no Asaas: o que a documentação diz (conferido em 19/11/2026)
Lido na documentação pública do Asaas (nenhuma chamada executada):
- `POST /v3/invoices` **não tem campo de competência**. O campo `effectiveDate` é descrito como "Data de emissão da nota" e é a data em que a emissão é **agendada**. Em nenhuma página consultada (agendar nota, emitir notas de serviço, FAQ, breaking changes, migração para o Portal Nacional) aparece o termo "competência" definido: a própria página de migração diz que o conteúdo "não define a data de competência" e manda confirmar na documentação de agendamento, que também não define.
- **Resposta do suporte do Asaas (chat de 19/11/2026, protocolo 2068696):** a competência **é o `effectiveDate`** (AAAA-MM-DD). Não há campo separado (`competenceDate` não existe). O Asaas **não** usa a data de vencimento nem a de pagamento como competência. Nota emitida no mês seguinte ao pagamento tem competência do **mês seguinte**; para a competência ficar no mês do pagamento, a emissão tem de ocorrer dentro do mesmo mês. Nota cancelada e reemitida vira **nova DPS com a data do reenvio** (não reemitir com data retroativa: o validador do Portal Nacional pode recusar; o suporte disse "pode", sem citar regra). **Consequência: o item (e) da lista da ligação com o contador é pergunta de verdade** (ver abaixo).
- **Conta ainda não migrada (informado pelo suporte em 19/11):** o cadastro mostrava que a conta **não estava configurada para o Portal Nacional**. Caminho: Notas Fiscais > Configurações > **Retomar configuração** (assistente de 3 passos: dados de acesso, serviços, informações fiscais). Depois de configurar, conferir em Configurações > Serviços se o código nacional está atualizado.
- **Série e número da DPS no assistente:** com certificado digital, série de **00001 a 49999**; o número é o da última nota emitida **fora do site do Portal Nacional** (se nunca houve, **1**). A última nota manual (03/11/2026, Selbetti) saiu no site com **série 90 e DPS 3**, e a numeração do site é separada: no Asaas usar **série 1 e número 1**. A nota de 03/11 mostra competência = data da emissão e inscrição municipal "-" (não informada).
- **Decisão a levar ao contador (item (e)):** pagamento nos últimos 7 dias do mês. Hoje o plano espera 8 dias (7 de arrependimento + 1 de folga), e a nota sairia no mês seguinte. Alternativas: (1) **emitir até o último dia do mês** mesmo dentro dos 7 dias e cancelar a nota se o cliente desistir (competência certa, mas pode haver cancelamento e custo de R$ 0,49; o prazo de cancelamento depende do Portal Nacional e do município, não confirmado); (2) **aceitar a competência do mês seguinte** nesses casos. O contador disse que o ideal é a nota no mês da competência.
- Para emitir antes da data agendada: `POST /v3/invoices/{id}/authorize` (não cria nota nova). Só notas `SCHEDULED` ou `ERROR` podem ser alteradas (`PUT /v3/invoices/{id}`), inclusive `effectiveDate`. O agendamento **não** é a emissão: vale o evento `INVOICE_AUTHORIZED`.
- **Cancelamento:** o Asaas diz que "nem todos os municípios permitem cancelamento automático pela integração" e que o resultado depende da prefeitura; eventos `INVOICE_PROCESSING_CANCELLATION`, `INVOICE_CANCELED` e `INVOICE_CANCELLATION_DENIED`. Não há prazo na documentação (item (g) segue para o contador/PBH).
- **Campos da Reforma Tributária existem na API** (`nbsCode`, `operationIndicatorCode`, `taxClassificationCode`, `taxSituationCode`, `federalServiceTaxCode`, `operationTypeCode`). Atenção (31/03/2026): em `PUT`, o objeto `taxes` **substitui tudo**; campo omitido é zerado.
- **Portal Nacional (Simples Nacional): obrigatório desde 01/11/2026** (Resolução CGSN 191/2026). No Asaas: Notas Fiscais > Configurações > Portal Emissor, preencher o Portal Nacional e autorizar a migração automática; certificado A1 recomendado; série da DPS de 1 a 49999 com certificado; a numeração segue a sequência já usada (validar com a contabilidade). Com o Portal Nacional, informar o código em `municipalServiceCode` (não usar `municipalServiceId`) e o Código de Tributação Nacional de 6 dígitos em `federalServiceTaxCode`. **A migração apaga os códigos de serviço das notas agendadas e das assinaturas.** Verificar na conta se isso já foi feito (item da seção 6).
- **IBS/CBS no Simples:** exigido na nota a partir de **01/01/2027**; algumas prefeituras já exigem em 2026. "Regime de apuração tributária" é obrigatório para o Simples.
- **Segunda resposta do Asaas (chat do painel, 19/11), que confirma e acrescenta:** a competência é a data em que a nota é emitida no Asaas; não há campo nem configuração para outra ("o sistema não faz emissões retroativas"); o time técnico ainda confirma se o `effectiveDate` é a referência direta (o atendimento por WhatsApp já havia dito que sim). **Alternativa citada por eles** para competência no mês anterior: **emitir a nota à mão no site do Portal Nacional** (fica sem vínculo com a cobrança no Asaas; dá para usar nas exceções de fim de mês, a confirmar com o contador). Cancelar não gera nota nova: é preciso emitir de novo, com a competência da nova emissão.
- **Como enviar a nota pela API (receitas do Asaas, lidas em 19/11):** usar `municipalServiceCode` + `municipalServiceName`; **não** usar `municipalServiceId` (não funciona no Portal Nacional). Como Belo Horizonte **usa complemento municipal** (a nota de 03/11 saiu com "01.03.01 / 004"), o código vai **completo, com pontos**: `01.05.01.001`. Esses campos **não podem ser editados** em uma nota existente (só `federalServiceTaxCode` em notas `SCHEDULED`/`ERROR`, e ele não aceita o complemento). `fiscalInfo`: `rpsSerie` de 1 a 49999 com certificado ("recomenda-se uma série nova"; com série nova, a primeira DPS é a 1; série e número repetidos dão erro), certificado A1 **da própria empresa** (o da contabilidade não vale). No Sandbox a emissão é só simulada. Em `PUT` de `invoiceSettings` o objeto `taxes` é substituído por inteiro.
- Fontes: [Agendar nota fiscal](https://docs.asaas.com/reference/agendar-nota-fiscal), [Migrar a emissão para o Portal Nacional via API](https://docs.asaas.com/recipes/migrar-a-emiss%C3%A3o-de-nota-fiscal-para-o-portal-nacional-via-api), [Adequar notas agendadas e assinaturas](https://docs.asaas.com/recipes/adequar-notas-agendadas-e-assinaturas-ao-portal-nacional), [Emitindo notas fiscais de serviço](https://docs.asaas.com/docs/emitindo-notas-fiscais-de-servico), [FAQ de notas fiscais](https://docs.asaas.com/docs/faq-de-notas-fiscais), [Breaking changes](https://docs.asaas.com/page/breaking-changes), [Migração do Simples Nacional para o Portal Nacional](https://docs.asaas.com/changelog/nfs-e-migra%C3%A7%C3%A3o-obrigat%C3%B3ria-do-simples-nacional-para-o-portal-nacional-em-01112026), [blog do Asaas sobre o Portal Nacional](https://blog.asaas.com/emissao-de-nota-fiscal-pelo-portal-nacional/).

### 3.4 Chargeback, em português claro

**Chargeback** é quando o titular do cartão **contesta a compra com o banco** (diz que não reconhece ou não recebeu) e a bandeira **devolve o dinheiro ao cliente, tirando de você**, mesmo semanas depois. No Asaas você vê o evento `PAYMENT_CHARGEBACK_REQUESTED`, que o nosso webhook já trata.

Por que importa para a nota: o Asaas só confirma o recebimento do cartão cerca de 30 dias depois, e a contestação pode vir bem depois da nossa emissão de 8 dias. Aí existe uma NFS-e **emitida para um dinheiro que voltou**. Duas perguntas **sim**, são para o contador (já estão na mensagem 3.1, pergunta 8): dá para cancelar a NFS-e (e até quando a PBH aceita)? e como recuperar o DAS pago sobre essa receita? A nossa parte técnica é pedir o cancelamento da nota (`POST /v3/invoices/{id}/cancel`) e avisar o admin.

Pix e boleto praticamente não têm esse risco (o estorno vira reembolso combinado), então o risco real é do **cartão**.

---

## 4. Fluxo final

```
Cliente paga (Asaas)
  -> webhook PAYMENT_CONFIRMED/RECEIVED (já existe) grava o pagamento e cria uma linha em fiscal_invoices (status waiting, release_at = confirmação + 8 dias)

Cron diário (novo) -> Edge Function fiscal-issue
  -> pega as linhas waiting com release_at vencido
  -> confere: pagamento ainda "paid", sem estorno/chargeback, dados do tomador completos, modo fiscal ligado
  -> tomador PJ ou modo "revisão": para em review (o SuperAdmin aprova); modo "automático": segue
  -> POST /v3/invoices (agendar) + POST /v3/invoices/{id}/authorize (emitir já)
  -> status scheduled

Webhook do Asaas (INVOICE_*)
  -> AUTHORIZED: guarda número, código, PDF e XML; envia o e-mail ao cliente (nosso Gerenciador de e-mails)
  -> ERROR: guarda o motivo, avisa o admin, aparece no painel para corrigir e reprocessar
  -> CANCELED / CANCELLATION_DENIED: atualiza o painel

Estorno ou chargeback (webhook que já existe)
  -> antes de emitir: marca skipped (não emite nunca)
  -> depois de emitir: pede cancelamento da nota e avisa o admin
```

Princípios: **uma nota por pagamento** (índice único), **idempotente** (rodar o cron duas vezes não duplica), **provedor trocável** (a tabela é nossa e não do Asaas, para poder emitir direto na API nacional no futuro), **segredos só na Edge Function** (a chave do Asaas já mora lá), **certificado só no painel do Asaas** (nunca no chat, no repositório nem no banco).

---

## 5. Plano de implementação

Ordem proposta; cada fase termina verificada (`tsc`, `npm test`, `npm run build`) e só avança se a anterior passou.

### Fase 0. Decisões e dados (sem código)
Mensagem 3.1 enviada e respondida (principalmente 1 a 8); decisão do regime de IBS/CBS até 27/11/2026; configuração do Asaas (seção 6); decidir a janela de espera (7 dias de arrependimento + 1 de folga = 8).

### Fase 1. Banco (script em `scripts/fiscal-notas.sql`, para você rodar no SQL Editor)
Tabela `public.fiscal_invoices` (RLS ligada sem policy, só o servidor lê com a chave de serviço, como as outras):

- `payment_id` (único: **uma nota por pagamento**), `user_id`, `asaas_payment_id`, `amount`, `cycle`, `period_start`, `period_end`;
- `status`: `waiting`, `review`, `needs_data`, `scheduling`, `scheduled`, `authorized`, `error`, `skipped`, `cancel_requested`, `canceled`; `skip_reason`;
- `release_at` (quando pode emitir), `tomador_snapshot` (jsonb: CPF/CNPJ, nome, endereço **no momento da emissão**, para histórico fiscal);
- `asaas_invoice_id`, `number`, `validation_code`, `pdf_url`, `xml_url`;
- `error_code`, `error_text`, `attempts`, `last_attempt_at`, `emailed_at`, `created_at`, `updated_at`.

Tabela `public.fiscal_settings_history` (quem mudou, quando, valor anterior e novo, **vigência**): a configuração fiscal é auditável. A configuração atual mora em `platform_settings` (chave `fiscal_settings`).

Mais: função para criar a linha a partir de um pagamento confirmado (chamada pelo webhook) e testes do SQL num PostgreSQL local, como foi feito em `scripts/test-sessoes-dispositivos-sql.mjs`.

### Fase 2. Núcleo puro (testável) em `supabase/functions/_shared/fiscalCore.ts`
Funções sem rede, usadas pela Edge Function e pelo painel (mesmo padrão de `billingCore.ts`, empacotado por `scripts/bundle-edge-functions.mjs`):
- `releaseAt(confirmedAt, waitDays)` em horário de Brasília;
- `buildDescription(cycle, paidAt, template)` (mensal, trimestral, semestral, anual; período final nos longos; nunca e-mail do cliente);
- `buildInvoicePayload(...)` (campos exatos da API do Asaas, valores em centavos, **sem alíquota quando não há retenção**);
- `eligibility(payment, profile, settings)` (pago, sem estorno, dados completos, modo ligado, PF ou PJ);
- `validateFiscalSettings(...)` (ex.: com retenção, alíquota entre 1,8% e 5%; códigos no formato certo);
- `mapAsaasError(...)` (erro de tomador, erro de município, erro temporário) para decidir entre `needs_data`, `error` e nova tentativa.

### Fase 3. Edge Function `fiscal-issue` + cron
- Função nova `supabase/functions/fiscal-issue/index.ts` (usa a chave do Asaas que já existe nos segredos) e rota `src/app/api/cron/fiscal-release/route.ts` (mesmo molde de `iclub-release`), com entrada em `vercel.json` (ex.: `0 12 * * *`).
- Cada linha é "reivindicada" com `update ... where status = 'waiting'` antes de chamar o Asaas (dois cron ao mesmo tempo não duplicam). Falha temporária: volta para `waiting` com `attempts + 1` e espera crescente; depois de N tentativas vira `error` e avisa.
- **Modo teste (sem envio):** monta o pedido completo e grava o que enviaria, **sem chamar o Asaas**. É assim que validamos a nossa parte sem depender do sandbox.

### Fase 4. Webhook (`supabase/functions/asaas-webhook/index.ts`)
- Nos eventos de pagamento confirmado: criar a linha fiscal (uma vez).
- Em `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED`: marcar `skipped` se ainda não emitiu; se já emitiu, pedir `POST /v3/invoices/{id}/cancel` e avisar o admin.
- Novos eventos `INVOICE_*`: atualizar a linha; no `AUTHORIZED`, enfileirar o e-mail ao cliente.
- **Ação sua no Asaas:** ligar os eventos de nota fiscal no webhook (seção 6).

### Fase 5. E-mail da nota ao cliente
- Novo assunto no Gerenciador de e-mails (`src/lib/email/routing.ts`: `fiscal_invoice`, remetente sugerido `financeiro@`), textos em pt, en e es, e um novo tipo de aviso na fila `billing_notices` (`fiscal_invoice_issued`), que já tem envio, deduplicação e e-mail ao admin.
- O e-mail leva o número, o valor, o período e o **link do PDF** (e o PDF anexado, se o `pdfUrl` puder ser baixado pelo servidor; a conferir na primeira nota).
- Alerta ao admin quando a nota der erro (reaproveitar `billing_team`).

### Fase 6. Painel "Fiscal" (aba Sistema, SuperAdmin) e Configuração fiscal
**Tela de Configuração fiscal** (cartão recolhível, como os outros da aba Sistema; é um cartão do painel e não um caso de uso do Studio; se você quis dizer outra coisa, me avise). Ela serve **para todos os campos da nota**, não só a alíquota:
- Modo (`off`, `test`, `review`, `auto`) e dias de espera;
- Código de tributação nacional (01.05.01), código municipal, NBS, indicador da operação, cClassTrib, regime de IBS/CBS (puro ou regular);
- ISS retido (padrão: não) e, **só quando há retenção**, a alíquota (1,8% a 5%) com data de vigência; INSS e IR (zero);
- Modelo da descrição, observações, assunto e remetente do e-mail;
- Regras por tipo de tomador (PF automático, PJ em revisão);
- Alertas: validade do certificado A1 (você informa o vencimento) e erro de nota;
- **Histórico de alterações** (quem, quando, antes e depois) e **vigência** de cada valor.

**Lista de notas** por status, com filtro, motivo do erro, botões **Aprovar** (revisão), **Reprocessar** e **Cancelar**, links do PDF/XML; contadores (aguardando, emitidas no mês, com erro em vermelho, valor emitido). Ações novas no servidor, sempre pela sessão do SuperAdmin (nunca por dado do corpo do pedido).

### Fase 7. Testes e produção
Seção 7. Entrada em produção **em modo revisão**, depois **automático**.

### Fase 8 (opcional, só se a retenção de ISS se mostrar frequente): alíquota efetiva do Simples calculada
**Pergunta do dono (17/11):** se eu cadastrar as últimas 12 notas, o sistema calcula a alíquota e fica automático? **Resposta: dá para calcular uma estimativa, com limites.**

Como o Simples calcula (Anexos III e V, para o CNAE 6203-1/00 e serviços de informática; o Anexo vale pelo **fator R**): alíquota efetiva = (RBT12 x alíquota nominal da faixa − parcela a deduzir) ÷ RBT12. A parte do ISS é uma fração dessa alíquota, dada pela tabela de repartição da faixa. O que o cálculo precisa:
- **RBT12**: receita bruta dos 12 meses **anteriores** ao mês de apuração, de **toda a empresa** (MetaBuilder, Selbetti e o que mais houver), pelo regime (caixa ou competência) que o contador usa. Como o RBT12 é do período anterior, ele **é conhecido no momento da emissão**.
- **Fator R** (folha de salários e pró-labore dos 12 meses ÷ RBT12; 28% ou mais vai para o Anexo III, abaixo disso para o V): dado que o sistema não tem; entra à mão (um número por mês) ou vem do contador.
- As **tabelas dos anexos** (faixas, alíquotas, deduções, repartição), que mudam por lei (a Reforma Tributária mexe nelas a partir de 2027).

Desenho possível:
1. Tela "Receita bruta do Simples" com os **12 totais mensais** anteriores (um valor por mês; não precisa cadastrar cada nota). Você preenche uma vez.
2. O sistema soma sozinho, a cada mês, o que o **MetaBuilder** emitiu; o que vem de **fora** (a nota mensal da Selbetti, por exemplo) você informa **uma vez por mês** (um número) ou, mais simples ainda, você informa o total mensal da empresa quando fechar com o contador.
3. O sistema mostra a **alíquota efetiva de ISS estimada** do mês e a usa só nas notas **com retenção**.
4. **Salvaguarda:** o número do contador (PGDAS-D) é o que vale. O sistema **sugere e nunca aplica sozinho**: aparece "estimado 3,10%; o do contador: [campo]", e o contador valida a estimativa nos primeiros meses.

Limites honestos:
- Só importa em notas **com retenção** (sem retenção, a regra oficial **proíbe** informar alíquota). Se os clientes retentores forem poucos, não compensa: basta o contador passar a alíquota uma vez e você guardá-la com data de vigência.
- É, na prática, um **mini-módulo de apuração do Simples**: exige manter as tabelas atualizadas e testá-las contra o PGDAS-D real. Erro de cálculo = retenção errada.
- Receita de fora do MetaBuilder continua exigindo entrada manual.

Recomendação: **não construir agora.** Fazer a Fase 6 (alíquota guardada com vigência e lembrete) e medir quantas notas têm retenção. Se forem muitas, a Fase 8 vira um projeto próprio.

### Segurança e privacidade (não negociável)
- A chave do Asaas e qualquer certificado **nunca** vão para o Next, o navegador, o chat ou o repositório.
- Não gravar na descrição da nota o e-mail do cliente nem dados bancários.
- Guardar só IDs e URLs; o PDF/XML mora no Asaas e no Portal Nacional.
- Atualizar a Política de Privacidade/Termos (já pendente de revisão jurídica): dado fiscal é retido por obrigação legal (cinco anos) e não pode ser apagado a pedido.

### Tamanho aproximado
Fase 1: pequena. Fase 2: média (a que mais pede cuidado). Fase 3: média. Fase 4: média. Fase 5: pequena. Fase 6: média a grande (por causa da configuração com histórico). Fase 7: depende do contador.

---

## 6. Roteiro de configuração no Asaas (você faz; eu não toco em segredo)

**Decisão do dono (17/11):** configurar e testar **direto em produção**. O custo é baixo (R$ 0,49 por nota e pouquíssimas notas), e o teste em produção dá a certeza que importa. Limite honesto: **não posso afirmar que a emissão pela API funciona**; não executei nenhuma chamada ao Asaas (a documentação diz que funciona). Por isso as salvaguardas abaixo.

Os nomes de menu mudam; se algo divergir, vale a Central de Ajuda do Asaas ("Configuração Portal Nacional").

**A. Fora do Asaas, antes**
- [ ] Respostas do contador para pelo menos as perguntas 1, 3, 5 e 6 da mensagem 3.1.
- [x] **Concluído em 17/11/2026** (alvará emitido; resultado no fim deste item). Inscrição municipal ativa na PBH, com o **novo endereço** e o item **01.05.01** habilitado. Como se conferia (histórico) (do mais fraco para o mais forte; os caminhos abaixo vêm de páginas da PBH e do gov.br, mas **não testei o passo a passo na tela**):
  1. **Emissor Nacional (o que você já fez):** o código 01.05.01.001 apareceu na tela de serviços. Mostra que o município tem o serviço parametrizado; **não prova** que o *seu* cadastro está atualizado.
  2. **Primeira etapa da nota no Emissor Nacional:** confira se os dados do **prestador** (endereço, inscrição municipal, situação no Simples) aparecem com o endereço **novo**.
  3. **Consulta pública por nome e por CNAE/BH** em [BHISS Digital > Consultas](https://prefeitura.pbh.gov.br/fazenda/bhissdigital/consultas): confirma que o CNAE 6203-1/00 liga ao subitem 1.05 e mostra a alíquota e o código de serviço (CTISS) em Belo Horizonte. Confere a **regra**, não o seu cadastro. Atenção: a PBH usa o CNAE com **desdobramento local** (8º e 9º dígitos) e a [página do Cadastro Municipal](https://prefeitura.pbh.gov.br/fazenda/redesim) diz que as atividades podem ser ajustadas por evento específico.
  4. **Seu cadastro de contribuinte:** hoje fica no **Emissor Nacional** ([nfse.gov.br/EmissorNacional](https://www.nfse.gov.br/EmissorNacional/)), e não mais no BHISS Digital (que segue só com a consulta por CNAE). Para o **alvará**, a PBH tem a consulta pública [alf.pbh.gov.br](https://alf.pbh.gov.br/publico/home/alfs/pesquisa), que aceita CNPJ, inscrição municipal ou **nº da consulta de viabilidade**.
  5. **Prova definitiva:** a **primeira nota** (em revisão). Se o cadastro estiver fora de ordem, o Emissor/Asaas rejeita com um código de erro e dizendo qual campo falhou.
  - **Resultado da sua conferência (17/11, à noite):**
    - **Emissor Nacional, "Exibir detalhes do emitente":** mostra o endereço **novo** (CEP 30.493-180, Rua José Hemetério de Andrade, 390, Buritis). Essa base vem do cadastro federal do CNPJ; **confirma o endereço nacional, não o cadastro municipal**. O campo Complemento vem em branco e editável (você pode digitar "APT 202" na hora de emitir).
    - **Consulta pública de alvarás da PBH (ALF), por CNPJ (feita antes do pedido do alvará, ainda em 17/11):** lista 3 alvarás, **todos de endereços antigos**: o único **ativo** (nº 2025083817, validade 27/08/2030) é da Rua Lauro Ferreira, 20, apto 304; os outros dois estão caducos. **Ainda não aparece alvará no endereço novo.**
    - **Leitura (corrigida depois de ver a consulta de viabilidade):** não é defasagem da Prefeitura. O **alvará (ALF) do endereço novo precisa ser solicitado por você** no sistema da PBH. A consulta de viabilidade **MGP2601108917** está **ADMITIDA** (12/11/2026, validade 11/05/2027) para 6201-5/01, **6203-1/00** e 6209-1/00 no endereço novo, "liberado por se tratar de residência do titular" (Lei 11.181/19, art. 177, II), área de 10 m², dispensada de licenciamento sanitário e ambiental, com escritório/sede como atividade auxiliar. O próprio documento diz que o ALF será concedido na modalidade **"IMEDIATO"** (emitido automaticamente, sem documentação) e que mudança de endereço exige **novo alvará** (art. 339, §3º). O 8599-6/04 (treinamento) está como **não exercida no local**.
    - **Como pedir (do PDF da consulta):** alf.pbh.gov.br > "Acessar Sistema" com gov.br > na página "Consultas de Viabilidade e Alvarás", na consulta admitida, clicar em **"Solicitar alvará de localização e funcionamento"** > informar os dados (a tela pede o nº da consulta, o CNPJ e o **nº da Inscrição Municipal**). **Atenção do próprio PDF:** só conclui se endereço, atividades e área da consulta forem **iguais aos da Inscrição Municipal**; se divergirem, corrige-se o documento errado antes. Se a Inscrição Municipal ainda estiver com o endereço antigo, é isso que vai travar o pedido.
    - **Consultas "Negadas" de 11/11** (MGP2601107967 e MGP2601108075): tentativas anteriores, sem efeito agora; "Solicitar análise específica" não é necessário. A tela "Meus Alvarás" ficou vazia para o seu gov.br; os alvarás antigos aparecem só na consulta pública.
    - **CONCLUÍDO (17/11/2026, ALF imediato):** o alvará foi emitido. **Nº 2026044693**, concedido em 17/11/2026, **válido até 17/11/2031**, situação **Ativo**, tipo "Alvará imediato", Inscrição Municipal **0.933.007/001-4** (data de registro 17/11/2026), endereço novo (Rua José Hemetério de Andrade, 390, apto 202, CEP 30493-180), área de 10 m², residência de um dos sócios. Atividades exercidas e **admitidas**: **6203-1/00** (desenvolvimento e licenciamento de programas não customizáveis), 6209-1/00 e 6201-5/01; atividade auxiliar escritório/sede; 8599-6/04 (treinamento) como **não exercida no local**. O sistema da PBH aceitou o pedido sem divergência com a Inscrição Municipal, então a pergunta 10 ao contador **deixa de ser necessária**.
    - **O que isso resolve para a nota:** o **CNAE 6203-1/00 está admitido no cadastro municipal, no endereço novo**, o que sustenta o item 01.05.01 em Belo Horizonte. A confirmação final continua sendo a primeira nota.
    - **Pendências pequenas depois do alvará:** (1) **conferir se a inscrição municipal no Emissor Nacional e na configuração fiscal do Asaas é a 0.933.007/001-4** (o campo "Data de registro" de 17/11 sugere que o cadastro foi refeito; se o número mudou, atualizar); (2) o alvará pede estar **afixado em local visível** (Decreto 14.060/2010, art. 6º): guardar uma cópia acessível; (3) o treinamento (8599-6/04) **não está licenciado nesse endereço**: se o MetaBuilder passar a oferecer treinamentos, isso pede nova alteração; (4) **confirmado em 18/11:** a consulta pública de alvarás mostra o novo (nº 2026044693) como **Ativo**, validade 17/11/2031, e o antigo (nº 2025083817) como **Substituído**; (5) **taxa anual (TFLF):** segundo a página de taxas da PBH, a **Taxa de Fiscalização, Localização e Funcionamento** é cobrada **todo ano** (lançamento por edital, vencimento em 10 de maio), é isenta para MEI e autônomos e **não tem isenção específica para microempresa nem para quem funciona na residência do sócio** (a página diz que a taxa vale mesmo em endereço residencial). Não achei cobrança **na emissão** do alvará. O valor não está na página: ver no Sistema de Emissão de Guias da PBH (por inscrição municipal) ou perguntar ao contador. A guia anual costuma ir por correio ao **endereço do cadastro** (agora o novo). A **Taxa de Fiscalização Sanitária** deve não se aplicar, já que o alvará diz que as suas atividades são dispensadas de licenciamento sanitário (inferência minha, a confirmar).
    - **Efeito na emissão:** a nota usa a inscrição municipal ativa e os dados do emitente do cadastro nacional; **não vejo o alvará antigo como bloqueio** da NFS-e, mas isso só se confirma na primeira nota (a PBH pode rejeitar se o cadastro municipal divergir).
  - O **protocolo REDESIM** que você tem mostra só a Receita Federal, o Integrador Estadual e a Junta (deferida em 17/11 às 17:16); **não há linha da Prefeitura**, então ele não prova que a PBH já recebeu a alteração.
- [x] Portal Nacional (nfse.gov.br): cadastro do CNPJ com o novo endereço (confirmado em 17/11 em "Exibir detalhes do emitente").
- [ ] Conferir se a inscrição municipal usada no Emissor Nacional e, depois, na configuração fiscal do Asaas é a **0.933.007/001-4** (a do alvará novo).
- [ ] Ver o valor e o vencimento da **taxa anual (TFLF)** com o contador ou no Sistema de Emissão de Guias da PBH.
- [ ] Certificado **e-CNPJ A1** válido (anotar a validade; ao vencer, as notas param).

**B. Salvaguardas (por testar em produção)**
- [ ] Interruptor sempre em **teste (sem envio)** ou **revisão** até a primeira nota ser conferida; nada automático antes disso.
- [ ] Testar com poucos pagamentos de valor baixo (os de R$ 5 que você já faz).
- [ ] Combinar com o contador **antes** que as notas de teste são fiscais reais: entram na receita; o plano é **cancelar** cada uma logo depois (R$ 0,49 cada).
- [ ] O prazo de cancelamento direto pelo emitente depende do Portal Nacional e do município (pode ser curto, ex.: 24 h; **não confirmei**): por isso o teste de cancelamento vem **logo depois** da emissão.
- [ ] A chave de API do Asaas **não vai para o chat**: fica nos segredos da Edge Function.

**C. Produção**
- [x] Notas fiscais > Configurações > aba **Portal emissor**: conferir se está em **Portal Nacional** (para Simples, a troca é obrigatória desde 1º/11/2026) e a autorização marcada. *(feito em 19/11/2026: Portal nacional em uso, migração concluída pelo assistente "Retomar configuração")*
- [x] Cadastrar o **certificado A1 no painel do Asaas** (recomendado frente ao usuário e senha do gov.br, que entregariam uma credencial pessoal ao Asaas). A senha do certificado você digita **somente no painel do Asaas**. *(feito em 19/11: certificado da própria empresa enviado, usuário com o CNPJ e senha em branco)*
- [x] Dados fiscais da empresa: regime Simples Nacional, inscrição municipal, **endereço novo**, CNAE. *(feito em 19/11: Simples Nacional "Sim", regime de apuração "federais e municipal pelo SN", regime especial "Nenhum", município "Sempre do prestador", NBS 1.1103.22.00, inscrição municipal 0.933.007/001-4 preenchida (limpar se a primeira nota for rejeitada por ela), série 1 e número 1)*
- [x] Cadastrar o serviço (código 01.05.01, NBS, indicador da operação, cClassTrib conforme o contador); **alíquota de ISS: ver 3.2** (sem retenção, a regra oficial não pede alíquota; deixar como o Asaas permitir e anotar o que ele exigiu). "Atualizar para novas e agendadas" quando o Asaas perguntar. *(feito em 19/11: 010501, complemento 01.05.01.001, NBS 1.1103.22.00, ISS 0, PIS/COFINS "00 - Nenhum", sem retenção, serviço padrão desligado, "Novas notas"; "Reforma tributária" em branco até a ligação com o contador)*
- [ ] **Desligar o envio da nota por e-mail pelo Asaas** (nós enviamos, para não chegar duplicado). *(PENDENTE: a aba Preferências não tem essa opção; clientes já são criados com `notificationDisabled: true`, que a documentação diz valer só para cobranças. Descobrir na primeira nota de teste ou perguntar ao suporte, protocolo 2068696)*
- [ ] **Conta compartilhada com outro app (TraderMasterPRO):** a **emissão automática por assinatura** deve ficar **desligada nas assinaturas do MetaBuilder** (nós emitimos pela API, depois do prazo de arrependimento); pode ficar ligada nas do outro app. A configuração fiscal do Asaas é da conta, então cada nota nossa leva código de serviço e valores explícitos. Os eventos `INVOICE_*` chegam de todos os apps; o webhook já ignora o que não é nosso. Regras completas em `docs/asaas-varios-apps.md`.
- [ ] **Chave de API de produção**: conferir se tem permissão para notas fiscais; se criar uma nova, trocar a atual nos segredos da Edge Function, sem colar no chat.
- [ ] **Webhook:** no webhook que já aponta para `asaas-webhook`, **ligar os eventos de nota fiscal** (autorizada, com erro, cancelamento em processo, cancelada, cancelamento negado), mantendo o token de autenticação atual.
- [ ] Anotar o **custo por nota** do seu contrato (R$ 0,49 é o preço público).
- [ ] Perguntar ao **suporte do Asaas**: (a) a competência pode diferir da data de emissão? (b) como o campo `taxes.iss` é tratado para Simples sem retenção? (c) o `pdfUrl` é público e baixável pelo servidor?

**D. Conferência final**
- [ ] No painel do Asaas, agendar **manualmente** uma nota de teste para um cliente seu (CPF seu), conferir o PDF e a competência.

---

## 7. Roteiro de testes

### 7.1 Automáticos (vitest), antes de qualquer nota real
- `fiscalCore`: `releaseAt` (fuso de Brasília, virada de mês e de ano), descrição para os 4 ciclos (tamanho, sem e-mail, período final), payload (centavos, campos obrigatórios, sem PIS/COFINS/CSLL, sem alíquota sem retenção), elegibilidade (pago, estornado, sem CPF/CNPJ, modo desligado, PJ em revisão), validação da configuração (alíquota 1,8% a 5% quando há retenção), mapeamento de erros.
- SQL: índice único por pagamento (a segunda tentativa de criar a linha não duplica), reivindicação concorrente (duas execuções, uma linha emitida).
- Webhook com resposta falsa do Asaas: pagamento duplicado, estorno antes e depois da emissão, `INVOICE_AUTHORIZED` duplicado (e-mail só uma vez), evento fora de ordem, **falha temporária e Asaas fora** (cenários que não dá para provocar em produção).
- Fonte: sem segredo no código, sem `console.log` de dados do cliente, textos nos 3 idiomas.
- **Modo teste (sem envio)** em produção: o sistema monta os pedidos reais dos pagamentos que chegarem e mostra no painel o que **enviaria**; você confere campo a campo sem emitir nada.

### 7.2 Produção (ponta a ponta, em modo revisão e com valores baixos)
Cada nota real de teste custa R$ 0,49 e deve ser **cancelada em seguida**, combinado com o contador.

| # | Cenário | Esperado |
|---|---|---|
| P1 | Pagamento de R$ 5 confirmado, modo `review`, dias de espera reduzidos para o teste | Linha `waiting`, depois `review`; **Aprovar** leva a `scheduled` e `authorized` com número, PDF e XML |
| P2 | Conferir a nota no **Portal Nacional** | Número, chave e código de verificação conferem; tomador, valor, código 01.05.01, NBS, descrição e ISS corretos |
| P3 | **Cancelar a nota logo depois** (botão do painel, `POST /v3/invoices/{id}/cancel`) | Status passa por `PROCESSING_CANCELLATION` e termina `CANCELED` (ou `CANCELLATION_DENIED`, e o painel mostra o motivo); conferir também no Portal Nacional |
| P4 | Tomador pessoa física (CPF) | Nota emitida; descrição sem e-mail; alíquota não enviada (sem retenção) |
| P5 | Tomador pessoa jurídica | Fica em `review` mesmo no modo automático (regra de retenção pendente); depois de aprovado, nota com CNPJ e razão social corretos |
| P6 | Cliente sem CPF/CNPJ ou sem CEP | Linha `needs_data`, alerta ao admin, **nada enviado ao Asaas** |
| P7 | Estorno **antes** de `release_at` (reembolsar um pagamento de teste) | Linha `skipped` (motivo estorno); nenhuma nota |
| P8 | Estorno **depois** da nota | Pedido de cancelamento enviado; painel mostra o resultado |
| P9 | Dado inválido (pedido rejeitado pelo Asaas) | Linha `error` com o motivo, em vermelho; **Reprocessar** depois de corrigir |
| P10 | Cron executado duas vezes seguidas | Uma única nota por pagamento |
| P11 | Webhook `INVOICE_AUTHORIZED` reenviado (reenvio manual pelo painel do Asaas, se existir) | Um único e-mail ao cliente |
| P12 | Modo `off` e modo `test` | `off`: nada criado. `test`: monta o pedido e grava o que enviaria, sem chamar o Asaas |
| P13 | Ciclos mensal, trimestral, semestral, anual | Descrição e valor corretos em cada um (conferir primeiro no modo `test`; emitir real só um ou dois) |
| P14 | Pagamento de upgrade (cobrança extra) | Uma nota própria do valor pago |
| P15 | Campanha com desconto e licenças grátis do iClub | Nota pelo valor **realmente pago**; licença grátis (sem pagamento) não gera nota |

Cenários que **não** dá para provocar em produção (Asaas fora do ar, falha temporária) são cobertos pelos testes automáticos com resposta falsa (7.1).

### 7.3 Primeira nota real
1. Interruptor em **revisão**, espera de 8 dias (ou reduzida para o teste).
2. Um pagamento real pequeno (os de R$ 5 que você já faz) ou o primeiro cliente real.
3. No dia da liberação, abrir a linha no painel, conferir **todos os campos** (tomador, valor, código, NBS, ISS, descrição) e **aprovar**.
4. Conferir a nota **no Portal Nacional** e o e-mail recebido pelo cliente (PDF, link, remetente).
5. **Cancelar** (P3) e confirmar o resultado; mostrar o PDF ao contador antes de passar para **automático**.

### 7.4 Rotina depois de ligar
- Painel: notas com erro (0), aguardando, emitidas no mês.
- Conciliação mensal: pagamentos pagos x notas autorizadas (relatório simples no painel).
- Alerta de **validade do certificado A1** (30 dias antes).
- Enviar ao contador o mês de XMLs (ou ele consulta o Portal Nacional).

---

## 8. Riscos e o que não foi verificado

- **Eu não executei nenhuma chamada ao Asaas.** O comportamento descrito vem da documentação deles. Por isso: testes automáticos com resposta falsa, modo teste sem envio e primeira nota em revisão.
- **Notas de teste em produção são fiscais reais** (entram na receita) e o cancelamento depende do prazo do Portal Nacional e do município.
- **Competência fiscal** (3.3): a API do Asaas só tem a data de emissão; confirmar com o suporte e com o contador.
- **Chargeback de cartão** depois da nota (3.4): depende do contador e da PBH.
- **Formatos dos campos da API** (NBS, indicador da operação, cClassTrib) e o tratamento de `taxes.iss` para Simples sem retenção: só se confirmam na primeira emissão.
- **cClassTrib para optante do Simples** e **tabela oficial NBS x indOp**: não confirmados em fonte oficial.
- **Dependência do Asaas:** emissão depende da integração dele com o Portal Nacional. O desenho (tabela nossa, provedor trocável) reduz o custo de sair. O caminho de emitir direto na API nacional (certificado A1 do seu lado) continua disponível.
- **Não li** os PDFs de viabilidade, REDESIM, QSA e a pasta "Procedimentos".
- Fontes secundárias (blogs, buscadores de código) foram usadas onde não achei a oficial; marcadas acima.

---

## 9. Fontes

- LC 116/2003, art. 3º e lista de serviços: [planalto.gov.br](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm)
- Anexo C (indOp do IBS/CBS) e Anexo I (regras da DPS): `docs/fiscal/anexo-c-indop-ibscbs-snnfse-v1-01.xlsx` e `docs/fiscal/anexo_i-sefin_adn-dps_nfse-snnfse-v1-01-20260209.xlsx`
- Asaas, Notas fiscais (visão geral): [docs.asaas.com](https://docs.asaas.com/docs/notas-fiscais-2.md) e [FAQ de notas fiscais](https://docs.asaas.com/docs/faq-de-notas-fiscais.md)
- Asaas, agendar nota fiscal (API): [docs.asaas.com](https://docs.asaas.com/reference/agendar-nota-fiscal)
- Asaas, mudanças da NFS-e em 2026: [blog.asaas.com](https://blog.asaas.com/release/mudancas-na-nfs-e-no-asaas/)
- Asaas, preço e requisitos: [asaas.com/nota-fiscal](https://asaas.com/nota-fiscal)
- Código 01.05.01 na NFS-e Nacional (fonte secundária): [buscadorncm.com.br](https://buscadorncm.com.br/nfse/ctribnac/10501)
- NBS 1.1103.22.00 (fonte secundária): [buscadorncm.com.br](https://buscadorncm.com.br/nbs/111032200)
- Prazos do IBS/CBS na NFS-e para o Simples (fontes secundárias): [brasil61](https://brasil61.com/n/empresas-de-servicos-comecam-a-informar-ibs-e-cbs-na-nfs-e-a-partir-desta-quinta-1-bras2617195), [meucontadoronline](https://www.meucontadoronline.com.br/blog/cclasstrib-simples-nacional-como-preencher-na-nfse/)

## 10. Pendências abertas depois da configuração do Asaas (19/11/2026)
- [ ] Resposta do suporte do Asaas: o R$ 0,49 é cobrado mesmo se a nota for cancelada? (perguntado no chat, protocolo 2068696)
- [ ] Onde desligar o e-mail da NFS-e ao cliente quando a nota é emitida pela API? (ver item de "Desligar o envio da nota por e-mail" na seção 6)
- [ ] Para o contador: **tributos aproximados** (Lei 12.741/2012): hoje a aba Preferências está em "Não incluir"; para venda ao consumidor final, precisa incluir?
- [ ] Para o contador: item (e) da lista (pagamento nos últimos 7 dias do mês), NBS/indicador/cClassTrib, IBS/CBS (prazo 27/11), plano anual, IRRF/INSS e exterior.
- [ ] Anotar a validade do certificado A1 (ao vencer, as notas param).
