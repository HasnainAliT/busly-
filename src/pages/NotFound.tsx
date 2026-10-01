import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StateCard } from '@/components/ui/states'

export default function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <StateCard
        className="glass max-w-md rounded-2xl"
        icon={<Compass />}
        title="This stop isn't on our map"
        description="The page you're looking for doesn't exist or has moved. Head back to Busly and pick another route."
        action={
          <Button asChild>
            <Link to="/">Back to Busly</Link>
          </Button>
        }
      />
    </div>
  )
}
