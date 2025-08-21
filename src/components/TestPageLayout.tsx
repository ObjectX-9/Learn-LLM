import Sidebar from './Sidebar'

interface TestPageLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

export default function TestPageLayout({ title, description, children }: TestPageLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
              <p className="text-gray-600">{description}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 