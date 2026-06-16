export interface CustomActionPlacement {
  location: string;
  contexts: string[];
  group_fields?: string[];
}

export function getActionContexts(action: any, location: string): string[] {
  if (action.placements && Array.isArray(action.placements)) {
    const placement = action.placements.find((p: CustomActionPlacement) => p.location === location);
    return placement ? placement.contexts : [];
  }

  // Fallbacks for backward compatibility
  const activeContexts: string[] = action.contexts
    ? (Array.isArray(action.contexts) ? action.contexts : [action.contexts])
    : (action.context ? [action.context] : ['row']);

  // If search
  if (location === 'search') {
    return activeContexts.filter(c => ['global_top', 'row', 'bulk', 'global_search', 'row_search'].includes(c)).map(c => c === 'global_search' ? 'global_top' : c === 'row_search' ? 'row' : c);
  }

  // If master
  if (location === 'master') {
    return activeContexts.filter(c => ['global_top', 'master_top', 'form_top', 'field_group'].includes(c)).map(c => c === 'master_top' || c === 'form_top' ? 'global_top' : c);
  }

  // If detail (any detail tab, since legacy applied to all)
  if (location.startsWith('detail:')) {
    return activeContexts.filter(c => ['global_detail', 'detail_top', 'detail_row', 'row', 'field_group'].includes(c)).map(c => c === 'global_detail' || c === 'detail_top' ? 'global_top' : c === 'detail_row' ? 'row' : c);
  }

  // If slot (personalizado specific target_tab fallback)
  if (location.startsWith('slot:')) {
    const slotId = location.replace('slot:', '');
    if (action.target_tab === slotId || action.target_tab_id === slotId) {
      return activeContexts.map(c => c === 'global_detail' ? 'global_top' : c);
    }
  }

  return [];
}

export function getActionGroupFields(action: any, location: string): string[] {
  if (action.placements && Array.isArray(action.placements)) {
    const placement = action.placements.find((p: CustomActionPlacement) => p.location === location);
    return placement?.group_fields || [];
  }
  
  // Legacy
  return action.group_fields || (action.group_field ? [action.group_field] : []);
}
