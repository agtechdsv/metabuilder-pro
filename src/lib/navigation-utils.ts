export interface MenuItem {
  id: string
  label: string
  description?: string
  icon?: string
  type: 'view' | 'link' | 'folder'
  target: string
  children?: MenuItem[]
}

export function findNavigationItem(
  items: MenuItem[],
  targetIdOrSlug: string
): MenuItem | null {
  for (const item of items) {
    if (item.id === targetIdOrSlug || item.target === targetIdOrSlug) {
      return item
    }
    if (item.children) {
      const found = findNavigationItem(item.children, targetIdOrSlug)
      if (found) return found
    }
  }
  return null
}

export function findBreadcrumbPath(
  items: MenuItem[],
  targetIdOrSlug: string,
  path: { label: string; href: string; icon?: string }[] = [],
  baseUrl: string = ''
): { label: string; href: string; icon?: string }[] | null {
  for (const item of items) {
    const isFolder = item.type === 'folder'
    const itemHref = isFolder 
      ? `${baseUrl}/dashboard/${item.id}`
      : item.type === 'view'
        ? `${baseUrl}/${item.target}`
        : item.target

    const currentPath = [...path, { label: item.label, href: itemHref, icon: item.icon }]

    // Check if this is the target
    if (item.id === targetIdOrSlug || item.target === targetIdOrSlug) {
      return currentPath
    }

    // Check children
    if (item.children && item.children.length > 0) {
      const found = findBreadcrumbPath(item.children, targetIdOrSlug, currentPath, baseUrl)
      if (found) return found
    }
  }
  return null
}
