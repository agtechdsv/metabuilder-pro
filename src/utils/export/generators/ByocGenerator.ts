import JSZip from 'jszip'

export function generateBYOC(zip: JSZip, customComponents: any[]) {
  if (!customComponents || customComponents.length === 0) return

  const customFolder = zip.folder('src/components/custom')
  if (!customFolder) return

  customComponents.forEach(comp => {
    // Ensure the filename is safe (alphanumeric)
    const safeName = comp.name.replace(/[^a-zA-Z0-9]/g, '')
    if (safeName && comp.code) {
      customFolder.file(`${safeName}.tsx`, comp.code)
    }
  })
}
