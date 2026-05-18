"use client";

import { format } from "date-fns";
import {
  Calendar,
  ChevronLeft,
  Edit,
  FileText,
  Layout,
  Loader2,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectCard } from "@/components/project/project-card";
import { QuotationCard } from "@/components/quotations/quotation-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomer } from "@/hooks/use-customers";

const CustomerDialog = dynamic(
  () => import("@/components/customers/customer-dialog").then((mod) => mod.CustomerDialog),
  { ssr: false },
);

export default function CustomerDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: customer, isLoading } = useCustomer(id);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="text-solar h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-2xl font-bold">Customer not found</h2>
        <Button
          variant="link"
          onClick={() => {
            router.push("/customers");
          }}
          className="mt-4"
        >
          Back to list
        </Button>
      </div>
    );
  }

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          router.push("/customers");
        }}
        className="group text-muted-foreground hover:text-foreground -ml-2"
      >
        <ChevronLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Customers
      </Button>

      {/* Header Profile Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-6">
          <Avatar className="bg-solar shadow-solar border-border/60 h-20 w-20 border-4 lg:h-24 lg:w-24">
            <AvatarFallback className="text-foreground bg-transparent text-2xl font-bold lg:text-3xl">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight lg:text-4xl">
              {customer.name}
            </h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5 text-sm">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </div>
              {customer.email && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Mail className="h-3.5 w-3.5" />
                  {customer.email}
                </div>
              )}
              {customer.city && (
                <div className="flex items-center gap-1.5 text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  {customer.city}
                </div>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            setEditDialogOpen(true);
          }}
          variant="outline"
          className="border-border/70 bg-muted/45 hover:bg-muted/55 gap-2"
        >
          <Edit className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="border-border/60 w-full justify-start border-b bg-transparent p-0">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:border-solar data-[state=active]:text-solar rounded-none border-b-2 border-transparent px-6 pt-2 pb-3 data-[state=active]:bg-transparent"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="quotations"
            className="data-[state=active]:border-solar data-[state=active]:text-solar rounded-none border-b-2 border-transparent px-6 pt-2 pb-3 data-[state=active]:bg-transparent"
          >
            Quotations
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="data-[state=active]:border-solar data-[state=active]:text-solar rounded-none border-b-2 border-transparent px-6 pt-2 pb-3 data-[state=active]:bg-transparent"
          >
            Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 md:grid-cols-3"
          >
            <Card className="border-border/60 bg-muted/45 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">General Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Address
                    </span>
                    <p className="text-sm leading-relaxed">
                      {customer.address || "No address provided"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      City
                    </span>
                    <p className="text-sm">{customer.city || "Not specified"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Notes
                  </span>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {customer.notes || "No notes added for this customer."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/60 bg-muted/45">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Customer Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Customer Since</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="text-solar h-3.5 w-3.5" />
                      {format(new Date(customer.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Quotes</span>
                    <span className="font-medium">{customer.quotations.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Projects</span>
                    <span className="font-medium">{customer.projects.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-muted/45">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Button
                    variant="outline"
                    className="hover:bg-solar/10 hover:text-solar hover:border-solar/20 border-border/60 bg-muted/45 justify-start gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    New Quotation
                  </Button>
                  <Button
                    variant="outline"
                    className="hover:bg-solar/10 hover:text-solar hover:border-solar/20 border-border/60 bg-muted/45 justify-start gap-2"
                  >
                    <Layout className="h-4 w-4" />
                    Create Project
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="quotations">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {customer.quotations.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {customer.quotations.map((quotation) => (
                  <QuotationCard
                    key={quotation.id}
                    quotation={{
                      ...quotation,
                      customer: { name: customer.name },
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="border-border/60 bg-muted/45 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center">
                <div className="text-muted-foreground bg-muted/45 flex h-20 w-20 items-center justify-center rounded-full">
                  <FileText className="h-10 w-10 opacity-20" />
                </div>
                <h3 className="text-foreground mt-6 text-xl font-semibold">No quotations yet</h3>
                <p className="text-muted-foreground mt-2 max-w-xs">
                  Create a solar quotation for this customer to get started.
                </p>
                <Button
                  className="bg-solar text-foreground mt-6"
                  onClick={() => {
                    router.push("/quotations/new");
                  }}
                >
                  Create Quotation
                </Button>
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="projects">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {customer.projects.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {customer.projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={{
                      ...project,
                      customerName: customer.name,
                      quoteNumber: project.quotation?.quoteNumber ?? null,
                      costTotal: project.costs.reduce(
                        (sum, c) => sum + Math.round(Number(c.amount)),
                        0,
                      ),
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="border-border/60 bg-muted/45 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center">
                <div className="text-muted-foreground bg-muted/45 flex h-20 w-20 items-center justify-center rounded-full">
                  <Layout className="h-10 w-10 opacity-20" />
                </div>
                <h3 className="text-foreground mt-6 text-xl font-semibold">No active projects</h3>
                <p className="text-muted-foreground mt-2 max-w-xs">
                  Once a quotation is accepted, it can be converted into a project.
                </p>
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {editDialogOpen && (
        <CustomerDialog
          customer={customer}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}
    </div>
  );
}
