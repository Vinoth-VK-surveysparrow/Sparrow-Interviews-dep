import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, Zap, Target, BarChart3, Clock, Users, Sparkles } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Speaking Training
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Master Public Speaking</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Build confidence and improve your speaking skills through interactive AI-powered games designed by
              communication experts.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Game 1: Rapid Fire Analogies */}
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-card/50">
            <CardHeader className="pb-4">
              
              <CardTitle className="font-serif text-xl">Rapid Fire</CardTitle>
              <CardDescription className="text-muted-foreground leading-relaxed">
                Build improvisation skills by completing analogies instantly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex text-sm text-muted-foreground text-justify items-center gap-8">
                <Clock className="w-4 h-4" />
                <span>2-5 minutes</span>
                
              </div>
              <Link href="/games/rapid-fire" className="block">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-xl">
                  Start Training
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Game 2: The Conductor */}
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-card/50">
            <CardHeader className="pb-4">
              
              <CardTitle className="font-serif text-xl">The Conductor</CardTitle>
              <CardDescription className="text-muted-foreground leading-relaxed">
                Master energy modulation by adjusting your speaking energy on command.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-sm text-muted-foreground gap-8">
                <Clock className="w-4 h-4" />
                <span>3-5 minutes</span>
                
              </div>
              <Link href="/games/conductor" className="block">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-xl">
                  Start Training
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Game 3: Triple Step */}
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-card/50">
            <CardHeader className="pb-4">
              
              <CardTitle className="font-serif text-xl">Triple Step</CardTitle>
              <CardDescription className="text-muted-foreground leading-relaxed">
                Handle distractions by weaving random words into your speech.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-sm text-muted-foreground gap-8">
                <Clock className="w-4 h-4" />
                <span>3-6 minutes</span>
                
              </div>
              <Link href="/games/triple-step" className="block">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-xl">
                  Start Training
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-12">Why Choose SparrowToast?</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-serif font-semibold text-lg mb-2">AI-Powered Feedback</h3>
              <p className="text-muted-foreground">Get instant, personalized feedback on your speaking performance.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-serif font-semibold text-lg mb-2">Expert-Designed</h3>
              <p className="text-muted-foreground">
                Games created by communication experts and public speaking coaches.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-chart-3/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-chart-3" />
              </div>
              <h3 className="font-serif font-semibold text-lg mb-2">Track Progress</h3>
              <p className="text-muted-foreground">Monitor your improvement with detailed analytics and insights.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
