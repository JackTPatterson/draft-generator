"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AreaChart,
  Area,
  Tooltip,
  BarChart,
  Bar, ResponsiveContainer, CartesianGrid, YAxis, XAxis,
} from 'recharts'
import { CalendarDays, CheckCircle, XCircle, Clock, Mail, Zap, ChevronLeft, ChevronRight, Ellipsis, MoreHorizontal } from "lucide-react"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface EmailStats {
  daily_stats: {
    date: string
    total_processed: number
    successful: number
    failed: number
    webhook_success: number
  }[]
  recent_emails: {
    processed_at: string
    processing_result: string
    webhook_response_code: number
    processing_time_ms: number
    subject: string
    from_email: string
    from_name: string
    error_message?: string
  }[]
  summary: {
    total_emails_processed: number
    total_successful: number
    total_failed: number
    avg_processing_time: number
    processed_today: number
  }
}



export function EmailProcessingChart() {
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/email-stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        const errorData = await response.json()
        console.error('Error fetching email stats:', errorData)
      }
    } catch (error) {
      console.error('Error fetching email stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Email Processing Analytics</CardTitle>
            <CardDescription>Loading email processing data...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-100 animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Processing Analytics</CardTitle>
          <CardDescription>Unable to load email processing data</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const successRate = stats.summary.total_emails_processed > 0 
    ? Math.round((stats.summary.total_successful / stats.summary.total_emails_processed) * 100)
    : 0

  // Format data for charts
  const chartData = stats.daily_stats.map(stat => ({
    date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    total: parseInt(stat.total_processed.toString()),
    failed: parseInt(stat.failed.toString()),
    webhook_success: parseInt(stat.webhook_success.toString())
  })).reverse() // Show oldest to newest

  const chartConfig = {
    webhook: {
      label: "Webhook Success",
      color: "#25206b",
    },
    failed: {
      label: "Failed",
      color: "#fff",
    },

  } satisfies ChartConfig;


  return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={'border-none shadow-none'}>
            <CardContent className="p-4 shadow-none border rounded-xl border-gray-300">
              <div className="flex items-center space-x-2">
                <div>
                  <div className="text-sm text-gray-500">Total Processed</div>
                  <div className="text-2xl font-black">{stats.summary.total_emails_processed}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={'border-none shadow-none'}>
            <CardContent className="p-4 shadow-none border rounded-xl border-gray-300">
              <div className="flex items-center space-x-2">
                <div>
                  <div className="text-sm text-gray-500">Success Rate</div>
                  <div className="text-2xl font-black">{successRate}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={'border-none shadow-none'}>
            <CardContent className="p-4 shadow-none border rounded-xl border-gray-300">
              <div className="flex items-center space-x-2">
                <div>
                  <div className="text-sm text-gray-500">Today</div>
                  <div className="text-2xl font-black">{stats.summary.processed_today}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={'border-none shadow-none'}>
            <CardContent className="p-4 shadow-none border rounded-xl border-gray-300">
              <div className="flex items-center space-x-2">
                <div>
                  <div className="text-sm text-gray-500">Avg Time</div>
                  <div className="text-2xl font-black">
                    {stats.summary.avg_processing_time ? Math.round(parseFloat(stats.summary.avg_processing_time.toString())) : 0}ms
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Processing Volume */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>Daily Processing Volume</span>
              </CardTitle>
              <CardDescription>
                Emails processed and sent to N8N workflow over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="date"/>
                  <YAxis width={24}/>
                  <ChartTooltip  content={<ChartTooltipContent indicator={'line'} hideLabel/>}/>
                  <defs>
                    <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                      <stop
                          offset="5%"
                          stopColor="#25206b"
                          stopOpacity={0.8}
                      />
                      <stop
                          offset="95%"
                          stopColor="#25206b"
                          stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#25206b"
                      fill="url(#fillMobile)"
                      fillOpacity={0.2}
                      name="Total Processed"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Success vs Failed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>Success vs Failed</span>
              </CardTitle>
              <CardDescription>
                Processing success rate and webhook delivery status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false}/>
                  <XAxis
                      dataKey="date"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      tickFormatter={(value) => value.slice(0, 3)} // Optional: keep short labels
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator={'line'} hideLabel/>}/>
                  {/*<ChartLegend content={<ChartLegendContent />} />*/}
                  <XAxis/>
                  <YAxis width={24}/>

                  {/* Successful = base layer */}
                  {/* Failed = middle layer */}
                  <Bar
                      dataKey="failed"
                      fill="var(--color-failed)"
                      radius={4}
                      name="Failed"
                  />

                  {/* Webhook success = top layer */}
                  <Bar
                      dataKey="webhook_success"
                      fill="var(--color-webhook)"
                      radius={4}
                      name="Webhook Success"
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Processing Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Processing Activity</CardTitle>
            <CardDescription>
              Latest emails processed and sent to your N8N workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recent_emails.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50"/>
                  <p>No emails have been processed yet</p>
                </div>
            ) : (
                <div className="w-full overflow-hidden rounded-xl border border-gray-300">
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader className="[&_tr]:border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="min-w-[300px] font-semibold text-foreground">Email</TableHead>
                          <TableHead className="w-[140px] font-semibold text-foreground">Status</TableHead>
                          <TableHead className="w-[120px] font-semibold text-foreground">Webhook</TableHead>
                          <TableHead className="w-[180px] font-semibold text-foreground">Processed</TableHead>
                          <TableHead className="w-[100px] font-semibold text-foreground">Duration</TableHead>
                          <TableHead className="w-[56px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.recent_emails.slice(0, 10).map((email, index) => (
                            <TableRow key={index} className="border-t hover:bg-muted/40">
                              <TableCell>
                                <div className="flex min-w-0 flex-col">
                                  <div className="truncate font-medium text-foreground">
                                    {email.subject || 'No Subject'}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    From: {email.from_name || email.from_email}
                                  </div>
                                  {email.error_message && (
                                      <div className="truncate text-xs text-destructive mt-1">
                                        Error: {email.error_message}
                                      </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                    variant={email.processing_result === 'success' ? 'default' : 'destructive'}
                                    className="text-xs"
                                >
                                  {email.processing_result === 'success' ? (
                                      <CheckCircle className="h-3 w-3 mr-1"/>
                                  ) : (
                                      <XCircle className="h-3 w-3 mr-1"/>
                                  )}
                                  {email.processing_result}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {email.webhook_response_code && (
                                    <Badge
                                        variant={email.webhook_response_code >= 200 && email.webhook_response_code < 300 ? "outline" : "secondary"}
                                        className="text-xs"
                                    >
                                      HTTP {email.webhook_response_code}
                                    </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(email.processed_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {email.processing_time_ms ? `${email.processing_time_ms}ms` : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4"/>
                                      <span className="sr-only">Open menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>View Details</DropdownMenuItem>
                                    <DropdownMenuItem>Retry Processing</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-end gap-2 p-3">
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4"/>
                      <span className="sr-only">Previous</span>
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" aria-current="page">
                      1
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      2
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      3
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <ChevronRight className="h-4 w-4"/>
                      <span className="sr-only">Next</span>
                    </Button>
                  </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}