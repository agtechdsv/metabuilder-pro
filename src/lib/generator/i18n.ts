export type GeneratorLanguage = 'pt' | 'en' | 'es'

export interface GeneratorDictionary {
  nav: {
    dashboard: string
    use_case: string
    access: string
    toggle_theme: string
    toggle_menu: string
    user_default: string
    logout: string
    logout_short: string
    close: string
  }
  downloads: {
    title: string
    subtitle: string
    queue_title: string
    queue_desc: string
    total_requested: string
    download_completed: string
    in_processing: string
    failures: string
    tab_all: string
    tab_completed: string
    tab_pending: string
    col_file: string
    col_records: string
    col_status: string
    col_actions: string
    empty_title: string
    empty_desc: string
    total_size: string
    folder_label: string
    retention_label: string
    forever_label: string
    delete_label: string
    download_label: string
  }
  list: {
    actions_header: string
    view_tooltip: string
    edit_tooltip: string
    delete_tooltip: string
    no_records: string
    show: string
    lines: string
    total: string
    prev_page: string
    next_page: string
    select_all: string
    select_row: string
    search: string
    clear: string
    new_record: string
    export_data: string
    export_format_title: string
    export_xlsx: string
    export_csv: string
    export_json: string
    export_failed: string
    all_filter: string
    filter_by: string
    connecting_db: string
    fetching_data: string
    badge_search: string
    new_record_column: string
    new_record_map: string
    new_record_timeline: string
  }
  form: {
    back_to_list: string
    new_prefix: string
    edit_record: string
    view_record: string
    fill_fields_desc: string
    save_first_hint: string
    autocomplete_hint: string
    autocomplete_empty: string
    autocomplete_loading: string
    autocomplete_placeholder: string
    cancel: string
    create_record: string
    save_changes: string
    saving: string
    back: string
    system_tag: string
  }
  delete_modal: {
    title: string
    warning: string
    are_you_sure: string
    about_to_delete: string
    this_record: string
    deleting: string
    confirm_delete: string
    error_deleting: string
  }
  login: {
    title: string
    welcome_back: string
    subtitle: string
    err_invalid: string
    err_credentials: string
    err_server: string
    err_config: string
    email: string
    password: string
    forgot_password: string
    enter_system: string
    back_to_home: string
  }
  feedback: {
    changes_saved: string
    err_saving_changes: string
    record_updated: string
    item_saved: string
    err_saving_item: string
    item_deleted: string
    err_deleting_item: string
    saved_successfully: string
    deleted_successfully: string
    error_saving: string
    error_deleting: string
    byoc_loaded: string
  }
}

const DICTIONARIES: Record<GeneratorLanguage, GeneratorDictionary> = {
  pt: {
    nav: {
      dashboard: 'Dashboard',
      use_case: 'CASO DE USO',
      access: 'ACESSAR',
      toggle_theme: 'Alternar Tema',
      toggle_menu: 'Abrir ou fechar o menu',
      user_default: 'Usuário',
      logout: 'Sair do Sistema',
      logout_short: 'Sair',
      close: 'Fechar',
    },
    downloads: {
      title: 'Gerenciador de Downloads',
      subtitle: 'Cópias das exportações geradas pelo sistema.',
      queue_title: 'ONDE FICAM OS ARQUIVOS',
      queue_desc: 'Cada exportação é baixada na hora e uma cópia fica guardada na pasta abaixo do servidor do app, por tempo limitado.',
      total_requested: 'Total Solicitado',
      download_completed: 'Download Concluído',
      in_processing: 'Em Processamento',
      failures: 'Falhas',
      tab_all: 'Todas',
      tab_completed: 'Concluídas',
      tab_pending: 'Pendentes',
      col_file: 'Arquivo',
      col_records: 'Registros',
      col_status: 'Status',
      col_actions: 'Ações',
      empty_title: 'Nenhuma exportação encontrada',
      empty_desc: 'Gere arquivos nas telas de listagem clicando em "Exportar".',
      total_size: 'Espaço usado',
      folder_label: 'Pasta',
      retention_label: 'Retenção',
      forever_label: 'sem expiração',
      delete_label: 'Excluir',
      download_label: 'Baixar',
    },
    list: {
      actions_header: 'AÇÕES',
      view_tooltip: 'Visualizar',
      edit_tooltip: 'Editar',
      delete_tooltip: 'Excluir',
      no_records: 'Nenhum registro encontrado.',
      show: 'Exibir',
      lines: 'Linhas',
      total: 'Total:',
      prev_page: 'Página anterior',
      next_page: 'Próxima página',
      select_all: 'Selecionar todas as linhas',
      select_row: 'Selecionar linha',
      search: 'Pesquisar',
      clear: 'Limpar',
      new_record: 'Novo Registro',
      export_data: 'Exportar Dados',
      export_format_title: 'Selecione o formato',
      export_xlsx: 'Excel (.xlsx)',
      export_csv: 'CSV (.csv)',
      export_json: 'JSON (.json)',
      export_failed: 'Não foi possível exportar.',
      all_filter: 'Todos',
      filter_by: 'Filtrar por',
      connecting_db: 'Conectando ao banco...',
      fetching_data: 'Buscando dados no Direct Access...',
      badge_search: 'PESQUISA CADASTRO',
      new_record_column: 'Novo registro nesta coluna',
      new_record_map: 'Novo Registro no Mapa',
      new_record_timeline: 'Novo Registro no Cronograma',
    },
    form: {
      back_to_list: 'Voltar para Lista',
      new_prefix: 'Novo',
      edit_record: 'Editar Registro',
      view_record: 'Visualizar Registro',
      fill_fields_desc: 'Preencha os campos para criar um novo registro no sistema.',
      save_first_hint: 'Salve o registro para liberar esta aba.',
      autocomplete_hint: 'Digite pelo menos {n} caracteres para buscar...',
      autocomplete_empty: 'Nenhum resultado encontrado.',
      autocomplete_loading: 'Buscando...',
      autocomplete_placeholder: 'Digite para pesquisar...',
      cancel: 'Cancelar',
      create_record: 'Criar Registro',
      save_changes: 'Salvar Alterações',
      saving: 'Salvando...',
      back: 'Voltar',
      system_tag: 'SISTEMA METABUILDER',
    },
    delete_modal: {
      title: 'Excluir Registro',
      warning: 'Esta ação não pode ser desfeita e removerá permanentemente os dados do banco.',
      are_you_sure: 'Você tem certeza?',
      about_to_delete: 'Você está prestes a excluir',
      this_record: 'este registro',
      deleting: 'Excluindo...',
      confirm_delete: 'Confirmar Exclusão',
      error_deleting: 'Não foi possível excluir o registro.',
    },
    login: {
      title: 'Login',
      welcome_back: 'Bem-vindo de volta!',
      subtitle: 'Entre com suas credenciais para acessar o sistema.',
      err_invalid: 'E-mail ou senha incorretos. Verifique suas credenciais.',
      err_credentials: 'Por favor, preencha o e-mail e a senha.',
      err_server: 'Erro ao processar login. Verifique a conexão com o banco de dados.',
      err_config: 'Tabela de autenticação não encontrada nos modelos do projeto.',
      email: 'E-mail',
      password: 'Senha',
      forgot_password: 'Esqueci minha senha?',
      enter_system: 'ENTRAR NO SISTEMA',
      back_to_home: '← VOLTAR AO INÍCIO',
    },
    feedback: {
      changes_saved: 'Alterações salvas com sucesso!',
      err_saving_changes: 'Erro ao salvar alterações.',
      record_updated: 'Registro atualizado com sucesso!',
      item_saved: 'Item salvo com sucesso!',
      err_saving_item: 'Erro ao salvar item.',
      item_deleted: 'Item excluído com sucesso!',
      err_deleting_item: 'Erro ao excluir item.',
      saved_successfully: 'salvo com sucesso!',
      deleted_successfully: 'excluído com sucesso!',
      error_saving: 'Erro ao salvar',
      error_deleting: 'Erro ao excluir',
      byoc_loaded: 'Componente BYOC personalizado carregado com sucesso.',
    },
  },
  en: {
    nav: {
      dashboard: 'Dashboard',
      use_case: 'USE CASE',
      access: 'ACCESS',
      toggle_theme: 'Toggle Theme',
      toggle_menu: 'Open or close the menu',
      user_default: 'User',
      logout: 'Log out',
      logout_short: 'Exit',
      close: 'Close',
    },
    downloads: {
      title: 'Download Manager',
      subtitle: 'Copies of the exports generated by the system.',
      queue_title: 'WHERE THE FILES ARE KEPT',
      queue_desc: 'Each export is downloaded right away and a copy is kept in the folder below on the app server, for a limited time.',
      total_requested: 'Total Requested',
      download_completed: 'Download Completed',
      in_processing: 'Processing',
      failures: 'Failed',
      tab_all: 'All',
      tab_completed: 'Completed',
      tab_pending: 'Pending',
      col_file: 'File',
      col_records: 'Records',
      col_status: 'Status',
      col_actions: 'Actions',
      empty_title: 'No exports found',
      empty_desc: 'Generate files from list views by clicking "Export".',
      total_size: 'Space used',
      folder_label: 'Folder',
      retention_label: 'Retention',
      forever_label: 'no expiration',
      delete_label: 'Delete',
      download_label: 'Download',
    },
    list: {
      actions_header: 'ACTIONS',
      view_tooltip: 'View',
      edit_tooltip: 'Edit',
      delete_tooltip: 'Delete',
      no_records: 'No records found.',
      show: 'Show',
      lines: 'Lines',
      total: 'Total:',
      prev_page: 'Previous page',
      next_page: 'Next page',
      select_all: 'Select all rows',
      select_row: 'Select row',
      search: 'Search',
      clear: 'Clear',
      new_record: 'New Record',
      export_data: 'Export Data',
      export_format_title: 'Select format',
      export_xlsx: 'Excel Spreadsheet (.xlsx)',
      export_csv: 'CSV File (.csv)',
      export_json: 'JSON Format (.json)',
      export_failed: 'Could not export.',
      all_filter: 'All',
      filter_by: 'Filter by',
      connecting_db: 'Connecting to database...',
      fetching_data: 'Fetching data from Direct Access...',
      badge_search: 'SEARCH & RECORDS',
      new_record_column: 'New record in this column',
      new_record_map: 'New Record on Map',
      new_record_timeline: 'New Record on Timeline',
    },
    form: {
      back_to_list: 'Back to List',
      new_prefix: 'New',
      edit_record: 'Edit Record',
      view_record: 'View Record',
      fill_fields_desc: 'Fill in the fields to create a new record in the system.',
      save_first_hint: 'Save the record to unlock this tab.',
      autocomplete_hint: 'Type at least {n} characters to search...',
      autocomplete_empty: 'No results found.',
      autocomplete_loading: 'Searching...',
      autocomplete_placeholder: 'Type to search...',
      cancel: 'Cancel',
      create_record: 'Create Record',
      save_changes: 'Save Changes',
      saving: 'Saving...',
      back: 'Back',
      system_tag: 'METABUILDER SYSTEM',
    },
    delete_modal: {
      title: 'Delete Record',
      warning: 'This action cannot be undone and will permanently remove data from the database.',
      are_you_sure: 'Are you sure?',
      about_to_delete: 'You are about to delete',
      this_record: 'this record',
      deleting: 'Deleting...',
      confirm_delete: 'Confirm Delete',
      error_deleting: 'Could not delete the record.',
    },
    login: {
      title: 'Login',
      welcome_back: 'Welcome back!',
      subtitle: 'Enter your credentials to access the system.',
      err_invalid: 'Invalid email or password. Please verify your credentials.',
      err_credentials: 'Please enter both email and password.',
      err_server: 'Error processing login. Check database connection.',
      err_config: 'Authentication table not found in project models.',
      email: 'Email',
      password: 'Password',
      forgot_password: 'Forgot password?',
      enter_system: 'SIGN IN',
      back_to_home: '← BACK TO HOME',
    },
    feedback: {
      changes_saved: 'Changes saved successfully!',
      err_saving_changes: 'Error saving changes.',
      record_updated: 'Record updated successfully!',
      item_saved: 'Item saved successfully!',
      err_saving_item: 'Error saving item.',
      item_deleted: 'Item deleted successfully!',
      err_deleting_item: 'Error deleting item.',
      saved_successfully: 'saved successfully!',
      deleted_successfully: 'deleted successfully!',
      error_saving: 'Error saving',
      error_deleting: 'Error deleting',
      byoc_loaded: 'Custom BYOC component loaded successfully.',
    },
  },
  es: {
    nav: {
      dashboard: 'Tablero',
      use_case: 'CASO DE USO',
      access: 'ACCEDER',
      toggle_theme: 'Cambiar Tema',
      toggle_menu: 'Abrir o cerrar el menú',
      user_default: 'Usuario',
      logout: 'Cerrar Sesión',
      logout_short: 'Salir',
      close: 'Cerrar',
    },
    downloads: {
      title: 'Gestor de Descargas',
      subtitle: 'Copias de las exportaciones generadas por el sistema.',
      queue_title: 'DONDE SE GUARDAN LOS ARCHIVOS',
      queue_desc: 'Cada exportación se descarga al instante y una copia se guarda en la carpeta indicada en el servidor de la app, por tiempo limitado.',
      total_requested: 'Total Solicitado',
      download_completed: 'Descarga Completada',
      in_processing: 'En Proceso',
      failures: 'Fallos',
      tab_all: 'Todas',
      tab_completed: 'Completadas',
      tab_pending: 'Pendientes',
      col_file: 'Archivo',
      col_records: 'Registros',
      col_status: 'Estado',
      col_actions: 'Acciones',
      empty_title: 'No se encontraron exportaciones',
      empty_desc: 'Genere archivos en las pantallas de listado haciendo clic en "Exportar".',
      total_size: 'Espacio usado',
      folder_label: 'Carpeta',
      retention_label: 'Retención',
      forever_label: 'sin vencimiento',
      delete_label: 'Eliminar',
      download_label: 'Descargar',
    },
    list: {
      actions_header: 'ACCIONES',
      view_tooltip: 'Visualizar',
      edit_tooltip: 'Editar',
      delete_tooltip: 'Eliminar',
      no_records: 'No se encontraron registros.',
      show: 'Mostrar',
      lines: 'Líneas',
      total: 'Total:',
      prev_page: 'Página anterior',
      next_page: 'Página siguiente',
      select_all: 'Seleccionar todas las filas',
      select_row: 'Seleccionar fila',
      search: 'Buscar',
      clear: 'Limpiar',
      new_record: 'Nuevo Registro',
      export_data: 'Exportar Datos',
      export_format_title: 'Seleccione el formato',
      export_xlsx: 'Excel (.xlsx)',
      export_csv: 'CSV (.csv)',
      export_json: 'JSON (.json)',
      export_failed: 'No fue posible exportar.',
      all_filter: 'Todos',
      filter_by: 'Filtrar por',
      connecting_db: 'Conectando a la base de datos...',
      fetching_data: 'Obteniendo datos de Direct Access...',
      badge_search: 'BÚSQUEDA Y REGISTROS',
      new_record_column: 'Nuevo registro en esta columna',
      new_record_map: 'Nuevo Registro en el Mapa',
      new_record_timeline: 'Nuevo Registro en el Cronograma',
    },
    form: {
      back_to_list: 'Volver a la Lista',
      new_prefix: 'Nuevo',
      edit_record: 'Editar Registro',
      view_record: 'Visualizar Registro',
      fill_fields_desc: 'Complete los campos para crear un nuevo registro en el sistema.',
      save_first_hint: 'Guarde el registro para habilitar esta pestaña.',
      autocomplete_hint: 'Escriba al menos {n} caracteres para buscar...',
      autocomplete_empty: 'No se encontraron resultados.',
      autocomplete_loading: 'Buscando...',
      autocomplete_placeholder: 'Escriba para buscar...',
      cancel: 'Cancelar',
      create_record: 'Crear Registro',
      save_changes: 'Guardar Cambios',
      saving: 'Guardando...',
      back: 'Volver',
      system_tag: 'SISTEMA METABUILDER',
    },
    delete_modal: {
      title: 'Eliminar Registro',
      warning: 'Esta acción no se puede deshacer y eliminará permanentemente los datos de la base de datos.',
      are_you_sure: '¿Está seguro?',
      about_to_delete: 'Está a punto de eliminar',
      this_record: 'este registro',
      deleting: 'Eliminando...',
      confirm_delete: 'Confirmar Eliminación',
      error_deleting: 'No se pudo eliminar el registro.',
    },
    login: {
      title: 'Iniciar Sesión',
      welcome_back: '¡Bienvenido de nuevo!',
      subtitle: 'Ingrese sus credenciales para acceder al sistema.',
      err_invalid: 'Correo o contraseña incorrectos. Verifique sus credenciales.',
      err_credentials: 'Por favor, complete el correo y la contraseña.',
      err_server: 'Error al procesar el inicio de sesión. Verifique la conexión con la base de datos.',
      err_config: 'Tabla de autenticación no encontrada en los modelos del proyecto.',
      email: 'Correo electrónico',
      password: 'Contraseña',
      forgot_password: '¿Olvidó su contraseña?',
      enter_system: 'INICIAR SESIÓN',
      back_to_home: '← VOLVER AL INICIO',
    },
    feedback: {
      changes_saved: '¡Cambios guardados con éxito!',
      err_saving_changes: 'Error al guardar los cambios.',
      record_updated: '¡Registro actualizado con éxito!',
      item_saved: '¡Elemento guardado con éxito!',
      err_saving_item: 'Error al guardar el elemento.',
      item_deleted: '¡Elemento eliminado con éxito!',
      err_deleting_item: 'Error al eliminar el elemento.',
      saved_successfully: 'guardado con éxito!',
      deleted_successfully: 'eliminado con éxito!',
      error_saving: 'Error al guardar',
      error_deleting: 'Error al eliminar',
      byoc_loaded: 'Componente BYOC personalizado cargado con éxito.',
    },
  },
}

export function getGeneratorDictionary(lang?: string): GeneratorDictionary {
  const normalized = (lang || 'pt').toLowerCase().slice(0, 2) as GeneratorLanguage
  return DICTIONARIES[normalized] || DICTIONARIES.pt
}
