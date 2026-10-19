const assetUrls = Object.values(
  import.meta.glob('../assets/*', { eager: true, query: '?url', import: 'default' }) as Record<
    string,
    string
  >,
)

const imageExtensions = /\.(png|jpe?g|webp|gif|avif)$/i

function preloadOne(url: string) {
  return new Promise<void>((resolve) => {
    if (imageExtensions.test(url)) {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = url
    } else {
      fetch(url)
        .then(() => resolve())
        .catch(() => resolve())
    }
  })
}

export function preloadAllAssets() {
  return Promise.all(assetUrls.map(preloadOne))
}
