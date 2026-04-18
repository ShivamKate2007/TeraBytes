export default function LoadingSkeleton({ type = 'text', width, height }) {
  const style = {}
  if (width) style.width = width
  if (height) style.height = height

  const className = `skeleton skeleton-${type}`
  return <div className={className} style={style} />
}
