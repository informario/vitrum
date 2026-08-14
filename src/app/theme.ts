const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
const pathSegments = pathname.split('/').filter(Boolean)

export const isLightMode = pathSegments.at(-1) === 'putoelquelee'
