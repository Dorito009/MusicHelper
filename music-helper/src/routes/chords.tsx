import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/chords')({
    component: ChordsPage,
    staticData: {
        title: "Music Helper | Chords",
        showNav: true,
    },
})

// eslint-disable-next-line react-refresh/only-export-components
function ChordsPage() {
  return <div>Hello "/chords"!</div>
}
