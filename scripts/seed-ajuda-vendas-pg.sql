-- =====================================================================================================
-- Ajuda da tela + dicas de campo (pt / en / es) para os casos de uso do projeto kika-projetos/vendas-pg
--
-- A ajuda não tem tabela própria: mora no JSON dos casos de uso. Por isso o script usa tabelas temporárias com os
-- textos (os INSERTs) e depois MESCLA esses textos em:
--   ui_views.layout_config      -> screen_help e fields_metadata[campo].label.help   (Central de Ajuda, ejeção)
--   ui_components.config        -> <zona>_config.label.help                          (o "?" dos campos no app)
--
-- Regras de segurança:
--   * NÃO sobrescreve: tela ou campo que já tem ajuda é mantido como está (ex.: Clientes > Nome Empresa);
--   * zonas com texto próprio (label.help_custom) não são tocadas;
--   * só casos de uso publicados (status = 'delivered'); não mexe em Automações, Downloads nem em rascunhos;
--   * pode ser rodado de novo sem efeito colateral.
--
-- Roda dentro de uma transação. O relatório final mostra o que foi gravado e o que ficou sem texto.
-- Para só simular: troque o COMMIT do fim por ROLLBACK.
-- =====================================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.has_help(j jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $f$
  SELECT j IS NOT NULL AND (
    (jsonb_typeof(j) = 'object' AND EXISTS (SELECT 1 FROM jsonb_each_text(j) e WHERE btrim(e.value) <> ''))
    OR (jsonb_typeof(j) = 'string' AND btrim(j #>> '{}') <> '')
  )
$f$;

-- ----------------------------------------------------------------------------------------------------
-- 1) Ajuda da tela
-- ----------------------------------------------------------------------------------------------------
CREATE TEMP TABLE _help_screen (slug text PRIMARY KEY, pt text, en text, es text) ON COMMIT DROP;

INSERT INTO _help_screen (slug, pt, en, es) VALUES
('bi---laboratorio',
 $$Painel analítico (BI) dos pedidos para explorar os dados com liberdade. Use os filtros por cliente e funcionário e acompanhe os resultados nos gráficos, que se atualizam na hora.$$,
 $$Analytics (BI) dashboard for orders, to explore the data freely. Use the customer and employee filters and follow the results in the charts, which update instantly.$$,
 $$Panel analítico (BI) de pedidos para explorar los datos con libertad. Use los filtros por cliente y empleado y siga los resultados en los gráficos, que se actualizan al instante.$$),
('bi---pedidos',
 $$Painel com os principais indicadores de pedidos. Use os filtros no topo para recortar por cliente ou funcionário; os gráficos acompanham o filtro.$$,
 $$Dashboard with the main order indicators. Use the filters at the top to narrow down by customer or employee; the charts follow the filter.$$,
 $$Panel con los principales indicadores de pedidos. Use los filtros de arriba para acotar por cliente o empleado; los gráficos siguen el filtro.$$),
('clientes---geospatial',
 $$Mapa dos clientes. Cada ponto é um cliente, posicionado pela latitude e longitude do cadastro. Use os filtros para encontrar um cliente e clique no ponto para ver os dados.$$,
 $$Map of the customers. Each point is a customer, placed by the latitude and longitude in its record. Use the filters to find a customer and click the point to see the details.$$,
 $$Mapa de los clientes. Cada punto es un cliente, ubicado por la latitud y longitud de su registro. Use los filtros para encontrar un cliente y haga clic en el punto para ver los datos.$$),
('departamentos',
 $$Cadastro dos departamentos da empresa. Pesquise pelo nome, inclua um departamento com Novo Registro e edite ou exclua pelas ações de cada linha.$$,
 $$Register of the company's departments. Search by name, add one with New Record, and edit or delete it from the actions on each row.$$,
 $$Registro de los departamentos de la empresa. Busque por nombre, agregue uno con Nuevo Registro y edite o elimine desde las acciones de cada fila.$$),
('empresa',
 $$Visão da estrutura da empresa em mapa mental. Clique em um item para abrir os detalhes e use os níveis para expandir ou recolher cada parte.$$,
 $$View of the company structure as a mind map. Click an item to open its details and use the levels to expand or collapse each part.$$,
 $$Vista de la estructura de la empresa como mapa mental. Haga clic en un elemento para abrir los detalles y use los niveles para expandir o contraer cada parte.$$),
('entregas',
 $$Agenda das entregas. Cada entrega aparece no dia da data estimada. Clique em uma entrega para ver ou editar o status, o motorista e a posição atual.$$,
 $$Delivery schedule. Each delivery appears on its estimated date. Click a delivery to see or edit its status, driver and current position.$$,
 $$Agenda de entregas. Cada entrega aparece en el día de su fecha estimada. Haga clic en una entrega para ver o editar el estado, el conductor y la posición actual.$$),
('funcs',
 $$Cadastro de funcionários. Pesquise pelo nome, inclua e edite funcionários e informe o departamento, o cargo e a data de contratação.$$,
 $$Employee register. Search by name, add and edit employees, and enter their department, job title and hire date.$$,
 $$Registro de empleados. Busque por nombre, agregue y edite empleados e indique el departamento, el cargo y la fecha de contratación.$$),
('gerenciamento-produtos',
 $$Tela personalizada para gerenciar os produtos: consultar, cadastrar e atualizar as informações do catálogo.$$,
 $$Custom screen to manage products: look up, register and update catalog information.$$,
 $$Pantalla personalizada para gestionar los productos: consultar, registrar y actualizar la información del catálogo.$$),
('kanban-tarefas',
 $$Quadro Kanban das tarefas. Cada coluna é um status: arraste o cartão para a coluna seguinte conforme o trabalho avança. Clique no cartão para editar prioridade, responsável e prazo.$$,
 $$Kanban board of the tasks. Each column is a status: drag the card to the next column as the work progresses. Click a card to edit priority, owner and due date.$$,
 $$Tablero Kanban de las tareas. Cada columna es un estado: arrastre la tarjeta a la siguiente columna a medida que avanza el trabajo. Haga clic en la tarjeta para editar prioridad, responsable y plazo.$$),
('pedidos',
 $$Cadastro de pedidos. Pesquise por cliente e funcionário, crie pedidos e acompanhe a situação. Em cada pedido, informe os itens (produto, quantidade e preço): os totais são calculados automaticamente.$$,
 $$Order register. Search by customer and employee, create orders and follow their status. In each order, enter the items (product, quantity and price): totals are calculated automatically.$$,
 $$Registro de pedidos. Busque por cliente y empleado, cree pedidos y siga su estado. En cada pedido, indique los ítems (producto, cantidad y precio): los totales se calculan automáticamente.$$),
('pedidos---timeline',
 $$Linha do tempo dos pedidos, em ordem de data. Acompanhe a evolução de cada pedido e use os filtros por cliente e funcionário.$$,
 $$Timeline of the orders, in date order. Follow how each order evolves and use the customer and employee filters.$$,
 $$Línea de tiempo de los pedidos, en orden de fecha. Siga la evolución de cada pedido y use los filtros por cliente y empleado.$$),
('produtos',
 $$Galeria de produtos com imagem. Filtre por nome e categoria e clique em um produto para ver os detalhes ou editar.$$,
 $$Product gallery with images. Filter by name and category and click a product to see its details or edit it.$$,
 $$Galería de productos con imagen. Filtre por nombre y categoría y haga clic en un producto para ver los detalles o editarlo.$$),
('projetos',
 $$Gráfico de Gantt dos projetos. Cada barra vai da data de início à data de fim e mostra o percentual concluído. Filtre por gerente e cliente.$$,
 $$Gantt chart of the projects. Each bar goes from the start date to the end date and shows the percentage completed. Filter by manager and customer.$$,
 $$Gráfico de Gantt de los proyectos. Cada barra va de la fecha de inicio a la fecha de fin y muestra el porcentaje completado. Filtre por gerente y cliente.$$),
('tarefas---fluxo',
 $$Fluxograma das tarefas. As ligações mostram a dependência entre elas, isto é, a ordem em que o trabalho deve acontecer. Filtre por projeto, responsável e prioridade.$$,
 $$Flowchart of the tasks. The links show the dependencies between them, that is, the order in which the work should happen. Filter by project, owner and priority.$$,
 $$Diagrama de flujo de las tareas. Los enlaces muestran la dependencia entre ellas, es decir, el orden en que debe realizarse el trabajo. Filtre por proyecto, responsable y prioridad.$$);

-- ----------------------------------------------------------------------------------------------------
-- 2) Dicas de campo, por nome da coluna. slug preenchido = texto só daquela tela (tem prioridade sobre o geral).
--    Colunas virtuais (calculadas) entram como 'virt:<rótulo>'.
-- ----------------------------------------------------------------------------------------------------
CREATE TEMP TABLE _help_col (slug text, col text NOT NULL, pt text, en text, es text) ON COMMIT DROP;

INSERT INTO _help_col (slug, col, pt, en, es) VALUES
(NULL, 'nome_empresa',
 $$Nome da empresa cliente. Use a razão social ou o nome fantasia pelo qual ela é conhecida.$$,
 $$Name of the client company. Use the legal name or the trade name it is known by.$$,
 $$Nombre de la empresa cliente. Use la razón social o el nombre comercial con el que se la conoce.$$),
(NULL, 'cnpj_cpf',
 $$CNPJ (empresa) ou CPF (pessoa física) do cliente, somente números. Identifica o cliente de forma única.$$,
 $$Client's company tax ID (CNPJ) or personal tax ID (CPF), digits only. It identifies the client uniquely.$$,
 $$CNPJ (empresa) o CPF (persona física) del cliente, solo números. Identifica al cliente de forma única.$$),
(NULL, 'email_contato',
 $$E-mail principal para falar com o cliente. Informe um endereço válido, como contato@empresa.com.br.$$,
 $$Main e-mail to contact the client. Enter a valid address, such as contact@company.com.$$,
 $$Correo principal para contactar al cliente. Ingrese una dirección válida, como contacto@empresa.com.$$),
(NULL, 'endereco',
 $$Endereço completo do cliente: rua, número, bairro, cidade e UF.$$,
 $$Client's full address: street, number, district, city and state.$$,
 $$Dirección completa del cliente: calle, número, barrio, ciudad y estado.$$),
(NULL, 'latitude',
 $$Latitude do endereço, em graus decimais (ex.: -23.5505). Posiciona o cliente no mapa.$$,
 $$Address latitude in decimal degrees (e.g. -23.5505). It places the client on the map.$$,
 $$Latitud de la dirección, en grados decimales (ej.: -23.5505). Ubica al cliente en el mapa.$$),
(NULL, 'longitude',
 $$Longitude do endereço, em graus decimais (ex.: -46.6333). Posiciona o cliente no mapa.$$,
 $$Address longitude in decimal degrees (e.g. -46.6333). It places the client on the map.$$,
 $$Longitud de la dirección, en grados decimales (ej.: -46.6333). Ubica al cliente en el mapa.$$),
(NULL, 'status_lead',
 $$Fase do cliente no funil comercial (por exemplo, Novo, Em Negociação ou Fechado). Atualize conforme o contato avança.$$,
 $$The client's stage in the sales funnel (for example New, In Negotiation or Won). Update it as the contact progresses.$$,
 $$Etapa del cliente en el embudo comercial (por ejemplo Nuevo, En Negociación o Cerrado). Actualícela a medida que avanza el contacto.$$),
(NULL, 'data_pedido',
 $$Data e hora em que o pedido foi feito.$$,
 $$Date and time the order was placed.$$,
 $$Fecha y hora en que se hizo el pedido.$$),

-- status: texto geral e variações por tela
(NULL, 'status',
 $$Situação atual do registro. Escolha um dos valores da lista.$$,
 $$Current status of the record. Pick one of the values in the list.$$,
 $$Estado actual del registro. Elija uno de los valores de la lista.$$),
('pedidos', 'status',
 $$Situação do pedido no processo, do registro até a entrega. Atualize conforme o pedido avança.$$,
 $$Order status in the process, from registration to delivery. Update it as the order moves on.$$,
 $$Estado del pedido en el proceso, desde el registro hasta la entrega. Actualícelo a medida que el pedido avanza.$$),
('pedidos---timeline', 'status',
 $$Situação do pedido no processo, do registro até a entrega. Atualize conforme o pedido avança.$$,
 $$Order status in the process, from registration to delivery. Update it as the order moves on.$$,
 $$Estado del pedido en el proceso, desde el registro hasta la entrega. Actualícelo a medida que el pedido avanza.$$),
('clientes', 'status',
 $$Situação do pedido no processo, do registro até a entrega. Atualize conforme o pedido avança.$$,
 $$Order status in the process, from registration to delivery. Update it as the order moves on.$$,
 $$Estado del pedido en el proceso, desde el registro hasta la entrega. Actualícelo a medida que el pedido avanza.$$),
('bi---pedidos', 'status',
 $$Situação do pedido. Filtre para analisar só os pedidos que estão nessa situação.$$,
 $$Order status. Filter to analyze only the orders in that status.$$,
 $$Estado del pedido. Filtre para analizar solo los pedidos en ese estado.$$),
('bi---laboratorio', 'status',
 $$Situação do pedido. Filtre para analisar só os pedidos que estão nessa situação.$$,
 $$Order status. Filter to analyze only the orders in that status.$$,
 $$Estado del pedido. Filtre para analizar solo los pedidos en ese estado.$$),
('entregas', 'status',
 $$Situação da entrega (por exemplo, pendente, em rota ou entregue). Atualize quando ela mudar.$$,
 $$Delivery status (for example pending, on route or delivered). Update it when it changes.$$,
 $$Estado de la entrega (por ejemplo pendiente, en ruta o entregada). Actualícelo cuando cambie.$$),
('kanban-tarefas', 'status',
 $$Etapa em que a tarefa está. No quadro Kanban, arraste o cartão entre as colunas para mudar o status.$$,
 $$Stage the task is in. On the Kanban board, drag the card between columns to change the status.$$,
 $$Etapa en la que está la tarea. En el tablero Kanban, arrastre la tarjeta entre las columnas para cambiar el estado.$$),
('tarefas---fluxo', 'status',
 $$Etapa em que a tarefa está no fluxo de trabalho.$$,
 $$Stage the task is in within the workflow.$$,
 $$Etapa en la que está la tarea dentro del flujo de trabajo.$$),
('projetos', 'status',
 $$Situação do projeto (por exemplo, planejado, em andamento ou concluído).$$,
 $$Project status (for example planned, in progress or completed).$$,
 $$Estado del proyecto (por ejemplo planificado, en curso o concluido).$$),

(NULL, 'funcionario_id',
 $$Funcionário responsável. Escolha na lista de funcionários cadastrados.$$,
 $$Responsible employee. Pick one from the list of registered employees.$$,
 $$Empleado responsable. Elija uno de la lista de empleados registrados.$$),
(NULL, 'cliente_id',
 $$Cliente relacionado a este registro. Escolha na lista de clientes cadastrados.$$,
 $$Customer related to this record. Pick one from the list of registered customers.$$,
 $$Cliente relacionado con este registro. Elija uno de la lista de clientes registrados.$$),
('projetos', 'cliente_id',
 $$Cliente para o qual o projeto é executado.$$,
 $$Customer the project is carried out for.$$,
 $$Cliente para el que se ejecuta el proyecto.$$),
(NULL, 'produto_id',
 $$Produto do item do pedido. Escolha na lista de produtos cadastrados.$$,
 $$Product of the order item. Pick one from the list of registered products.$$,
 $$Producto del ítem del pedido. Elija uno de la lista de productos registrados.$$),
(NULL, 'quantidade',
 $$Quantidade de unidades do produto neste item.$$,
 $$Number of units of the product in this item.$$,
 $$Cantidad de unidades del producto en este ítem.$$),
('produtos', 'quantidade',
 $$Quantidade deste produto disponível em estoque.$$,
 $$Quantity of this product available in stock.$$,
 $$Cantidad de este producto disponible en existencias.$$),
(NULL, 'preco_unitario',
 $$Preço de uma unidade do produto neste item, em reais.$$,
 $$Price of one unit of the product in this item, in reais.$$,
 $$Precio de una unidad del producto en este ítem, en reales.$$),
('produtos', 'preco_unitario',
 $$Preço de venda de uma unidade do produto, em reais.$$,
 $$Selling price of one unit of the product, in reais.$$,
 $$Precio de venta de una unidad del producto, en reales.$$),
(NULL, 'virt:Total Item',
 $$Calculado automaticamente: quantidade vezes preço unitário deste item. Não é editável.$$,
 $$Calculated automatically: quantity times the unit price of this item. Not editable.$$,
 $$Calculado automáticamente: cantidad por precio unitario de este ítem. No es editable.$$),
(NULL, 'virt:Total Pedido',
 $$Calculado automaticamente: soma dos totais de todos os itens do pedido. Não é editável.$$,
 $$Calculated automatically: sum of the totals of all the items in the order. Not editable.$$,
 $$Calculado automáticamente: suma de los totales de todos los ítems del pedido. No es editable.$$),

(NULL, 'nome',
 $$Nome do registro, como ele será exibido nas listas e buscas.$$,
 $$Name of the record, as it will be shown in lists and searches.$$,
 $$Nombre del registro, tal como se mostrará en las listas y búsquedas.$$),
('departamentos', 'nome',
 $$Nome do departamento.$$,
 $$Name of the department.$$,
 $$Nombre del departamento.$$),
('funcs', 'nome',
 $$Nome completo do funcionário.$$,
 $$Employee's full name.$$,
 $$Nombre completo del empleado.$$),
('produtos', 'nome',
 $$Nome do produto, como ele será exibido na galeria e nas buscas.$$,
 $$Product name, as it will be shown in the gallery and searches.$$,
 $$Nombre del producto, tal como se mostrará en la galería y en las búsquedas.$$),
('projetos', 'nome',
 $$Nome do projeto, como aparecerá no gráfico de Gantt.$$,
 $$Project name, as it will appear in the Gantt chart.$$,
 $$Nombre del proyecto, tal como aparecerá en el gráfico de Gantt.$$),
(NULL, 'criado_em',
 $$Data e hora em que o registro foi criado. Preenchida automaticamente pelo sistema.$$,
 $$Date and time the record was created. Filled in automatically by the system.$$,
 $$Fecha y hora en que se creó el registro. La completa el sistema automáticamente.$$),

(NULL, 'pedido_id',
 $$Pedido que será entregue. Escolha na lista de pedidos.$$,
 $$Order to be delivered. Pick one from the list of orders.$$,
 $$Pedido que se entregará. Elija uno de la lista de pedidos.$$),
(NULL, 'data_estimada',
 $$Data prevista para a entrega chegar ao cliente. Define o dia em que ela aparece na agenda.$$,
 $$Expected date for the delivery to reach the customer. It sets the day it appears on the schedule.$$,
 $$Fecha prevista para que la entrega llegue al cliente. Define el día en que aparece en la agenda.$$),
(NULL, 'motorista_id',
 $$Motorista responsável por esta entrega. Escolha na lista.$$,
 $$Driver responsible for this delivery. Pick one from the list.$$,
 $$Conductor responsable de esta entrega. Elija uno de la lista.$$),
(NULL, 'lat_atual',
 $$Latitude atual do veículo, em graus decimais. Atualizada durante a rota para mostrar a posição da entrega.$$,
 $$Vehicle's current latitude in decimal degrees. Updated during the route to show where the delivery is.$$,
 $$Latitud actual del vehículo, en grados decimales. Se actualiza durante la ruta para mostrar dónde está la entrega.$$),
(NULL, 'lng_atual',
 $$Longitude atual do veículo, em graus decimais. Atualizada durante a rota para mostrar a posição da entrega.$$,
 $$Vehicle's current longitude in decimal degrees. Updated during the route to show where the delivery is.$$,
 $$Longitud actual del vehículo, en grados decimales. Se actualiza durante la ruta para mostrar dónde está la entrega.$$),

(NULL, 'departamento_id',
 $$Departamento em que o funcionário trabalha. Escolha na lista de departamentos.$$,
 $$Department the employee works in. Pick one from the list of departments.$$,
 $$Departamento en el que trabaja el empleado. Elija uno de la lista de departamentos.$$),
(NULL, 'email',
 $$E-mail corporativo do funcionário.$$,
 $$Employee's work e-mail.$$,
 $$Correo corporativo del empleado.$$),
(NULL, 'cargo',
 $$Cargo ou função do funcionário na empresa.$$,
 $$Employee's job title or role in the company.$$,
 $$Cargo o función del empleado en la empresa.$$),
(NULL, 'data_contratacao',
 $$Data em que o funcionário foi contratado.$$,
 $$Date the employee was hired.$$,
 $$Fecha en que se contrató al empleado.$$),

(NULL, 'titulo',
 $$Título curto que descreve a tarefa.$$,
 $$Short title describing the task.$$,
 $$Título corto que describe la tarea.$$),
(NULL, 'projeto_id',
 $$Projeto ao qual a tarefa pertence. Escolha na lista de projetos.$$,
 $$Project the task belongs to. Pick one from the list of projects.$$,
 $$Proyecto al que pertenece la tarea. Elija uno de la lista de proyectos.$$),
(NULL, 'responsavel_id',
 $$Pessoa responsável por executar a tarefa.$$,
 $$Person responsible for carrying out the task.$$,
 $$Persona responsable de ejecutar la tarea.$$),
(NULL, 'prioridade',
 $$Urgência da tarefa (por exemplo, baixa, média ou alta). Ajuda a decidir o que fazer primeiro.$$,
 $$Urgency of the task (for example low, medium or high). It helps decide what to do first.$$,
 $$Urgencia de la tarea (por ejemplo baja, media o alta). Ayuda a decidir qué hacer primero.$$),
(NULL, 'data_vencimento',
 $$Prazo para concluir a tarefa.$$,
 $$Deadline to finish the task.$$,
 $$Plazo para concluir la tarea.$$),
(NULL, 'tarefa_antecessora_id',
 $$Tarefa que precisa terminar antes desta começar. Define a dependência entre as tarefas.$$,
 $$Task that must finish before this one can start. It sets the dependency between tasks.$$,
 $$Tarea que debe terminar antes de que esta comience. Define la dependencia entre las tareas.$$),

(NULL, 'descricao',
 $$Descrição do produto exibida na galeria: características, medidas e diferenciais.$$,
 $$Product description shown in the gallery: features, dimensions and selling points.$$,
 $$Descripción del producto que se muestra en la galería: características, medidas y diferenciales.$$),
(NULL, 'categoria_id',
 $$Categoria do produto, usada para agrupar e filtrar a galeria.$$,
 $$Product category, used to group and filter the gallery.$$,
 $$Categoría del producto, usada para agrupar y filtrar la galería.$$),
(NULL, 'url_imagem',
 $$Endereço (URL) da imagem do produto exibida na galeria. Use um link que abra a imagem diretamente.$$,
 $$Address (URL) of the product image shown in the gallery. Use a link that opens the image directly.$$,
 $$Dirección (URL) de la imagen del producto que se muestra en la galería. Use un enlace que abra la imagen directamente.$$),

(NULL, 'gerente_id',
 $$Gerente responsável pelo projeto. Escolha na lista de funcionários.$$,
 $$Manager responsible for the project. Pick one from the list of employees.$$,
 $$Gerente responsable del proyecto. Elija uno de la lista de empleados.$$),
(NULL, 'data_inicio',
 $$Data de início do projeto. Define onde a barra começa no gráfico de Gantt.$$,
 $$Project start date. It sets where the bar begins in the Gantt chart.$$,
 $$Fecha de inicio del proyecto. Define dónde comienza la barra en el gráfico de Gantt.$$),
(NULL, 'data_fim',
 $$Data prevista de término do projeto. Define onde a barra termina no gráfico de Gantt.$$,
 $$Expected project end date. It sets where the bar ends in the Gantt chart.$$,
 $$Fecha prevista de finalización del proyecto. Define dónde termina la barra en el gráfico de Gantt.$$),
(NULL, 'percentual_conclusao',
 $$Percentual já concluído do projeto, de 0 a 100. Aparece como avanço na barra do Gantt.$$,
 $$Percentage of the project already completed, from 0 to 100. It shows as progress on the Gantt bar.$$,
 $$Porcentaje ya completado del proyecto, de 0 a 100. Se muestra como avance en la barra del Gantt.$$);

-- ----------------------------------------------------------------------------------------------------
-- 3) Aplicação (mescla; não sobrescreve ajuda existente)
-- ----------------------------------------------------------------------------------------------------
CREATE TEMP TABLE _help_report (slug text, kind text, detail text) ON COMMIT DROP;

DO $do$
DECLARE
  pid uuid := (SELECT p.id FROM projects p JOIN workspaces w ON w.id = p.workspace_id WHERE w.slug = 'kika-projetos' AND p.slug = 'vendas-pg');
  v record; s record; c record; d record;
  lc jsonb; fm jsonb; cfg jsonb; ent jsonb; src jsonb; hlp jsonb;
  fid text; colname text; zk text; z text; first_zone boolean;
  n_screen int; n_field int; n_comp int; skipped_existing int;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Projeto kika-projetos/vendas-pg não encontrado.'; END IF;

  FOR v IN
    SELECT id, slug, layout_config FROM ui_views
     WHERE project_id = pid AND status = 'delivered' 
  LOOP
    lc := coalesce(v.layout_config, '{}'::jsonb);
    fm := coalesce(lc -> 'fields_metadata', '{}'::jsonb);
    n_screen := 0; n_field := 0; n_comp := 0; skipped_existing := 0;

    -- ajuda da tela
    SELECT * INTO s FROM _help_screen WHERE slug = v.slug;
    IF FOUND AND NOT pg_temp.has_help(lc -> 'screen_help') THEN
      lc := lc || jsonb_build_object('screen_help', jsonb_build_object('pt', s.pt, 'en', s.en, 'es', s.es));
      n_screen := 1;
    END IF;

    -- campos de qualquer zona (filtro, grid, formulário), sem repetir
    FOR fid IN
      SELECT DISTINCT CASE WHEN jsonb_typeof(e) = 'string' THEN e #>> '{}' ELSE e ->> 'id' END
        FROM unnest(ARRAY['form_fields', 'grid_fields', 'filter_fields']) AS zn(name),
             LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(lc -> zn.name) = 'array' THEN lc -> zn.name ELSE '[]'::jsonb END) AS e
    LOOP
      CONTINUE WHEN fid IS NULL OR fid LIKE 'byoc\_%';
      IF fid LIKE 'virt\_%' THEN
        colname := 'virt:' || coalesce(fm -> fid -> 'label' ->> 'text', '');
      ELSE
        SELECT f.db_column_name INTO colname FROM fields f WHERE f.id::text = fid;
      END IF;
      CONTINUE WHEN colname IS NULL;

      SELECT * INTO d FROM _help_col WHERE _help_col.col = colname AND _help_col.slug = v.slug;
      IF NOT FOUND THEN SELECT * INTO d FROM _help_col WHERE _help_col.col = colname AND _help_col.slug IS NULL; END IF;
      IF NOT FOUND THEN
        INSERT INTO _help_report VALUES (v.slug, 'sem_texto', colname);
        CONTINUE;
      END IF;

      -- campo que já tem dica padrão fica como está
      IF pg_temp.has_help(fm -> fid -> 'label' -> 'help') THEN skipped_existing := skipped_existing + 1; CONTINUE; END IF;

      hlp := jsonb_build_object('pt', d.pt, 'en', d.en, 'es', d.es);
      FOREACH zk IN ARRAY ARRAY[fid, 'filter-' || fid, 'grid-' || fid, 'form-' || fid] LOOP
        ent := fm -> zk;
        IF zk = fid THEN
          fm := jsonb_set(fm, ARRAY[zk], coalesce(ent, '{}'::jsonb) || jsonb_build_object('label', coalesce(ent -> 'label', '{}'::jsonb) || jsonb_build_object('help', hlp)));
        ELSIF ent IS NOT NULL AND coalesce(ent -> 'label' ->> 'help_custom', 'false') <> 'true' AND NOT pg_temp.has_help(ent -> 'label' -> 'help') THEN
          fm := jsonb_set(fm, ARRAY[zk], ent || jsonb_build_object('label', coalesce(ent -> 'label', '{}'::jsonb) || jsonb_build_object('help', hlp)));
        END IF;
      END LOOP;
      n_field := n_field + 1;
    END LOOP;

    lc := jsonb_set(lc, '{fields_metadata}', fm);
    IF lc IS DISTINCT FROM coalesce(v.layout_config, '{}'::jsonb) THEN
      UPDATE ui_views SET layout_config = lc WHERE id = v.id;
    END IF;

    -- o app em execução lê a dica dos campos em ui_components (<zona>_config.label.help)
    FOR c IN SELECT id, field_id, config FROM ui_components WHERE view_id = v.id LOOP
      cfg := c.config; first_zone := true;
      FOR z IN SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(cfg -> 'zones') = 'array' THEN cfg -> 'zones' ELSE '[]'::jsonb END) LOOP
        src := coalesce(fm -> (z || '-' || c.field_id::text), fm -> c.field_id::text);
        IF src IS NOT NULL AND pg_temp.has_help(src -> 'label' -> 'help')
           AND NOT pg_temp.has_help(cfg -> (z || '_config') -> 'label' -> 'help') THEN
          cfg := jsonb_set(cfg, ARRAY[z || '_config'], coalesce(cfg -> (z || '_config'), '{}'::jsonb)
                   || jsonb_build_object('label', coalesce(cfg -> (z || '_config') -> 'label', '{}'::jsonb) || jsonb_build_object('help', src -> 'label' -> 'help')));
          IF first_zone THEN
            cfg := cfg || jsonb_build_object('label', coalesce(cfg -> 'label', '{}'::jsonb) || jsonb_build_object('help', src -> 'label' -> 'help'));
          END IF;
        END IF;
        first_zone := false;
      END LOOP;
      IF cfg IS DISTINCT FROM c.config THEN
        UPDATE ui_components SET config = cfg WHERE id = c.id;
        n_comp := n_comp + 1;
      END IF;
    END LOOP;

    INSERT INTO _help_report VALUES (v.slug, 'aplicado', format('tela=%s campos=%s componentes=%s ja_tinham=%s', n_screen, n_field, n_comp, skipped_existing));
  END LOOP;
END
$do$;

-- ----------------------------------------------------------------------------------------------------
-- 4) Relatório
-- ----------------------------------------------------------------------------------------------------
SELECT slug, kind, detail FROM _help_report ORDER BY kind, slug, detail;

COMMIT;
