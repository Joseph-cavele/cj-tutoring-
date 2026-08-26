$dirs = @(
    "src/app/api/auth",
    "src/app/api/students",
    "src/app/api/tutors",
    "src/app/api/classes",
    "src/app/api/bookings",
    "src/app/api/attendance",
    "src/app/api/assignments",
    "src/app/api/tests",
    "src/app/api/results",
    "src/app/api/performance",
    "src/app/api/materials",
    "src/app/api/payments",
    "src/app/api/packages",
    "src/app/api/notifications",
    "src/app/api/zoom",
    "src/app/api/ai",
    "src/app/api/webhooks",
    "src/app/dashboard",
    "src/app/student",
    "src/app/tutor",
    "src/app/admin",
    "src/components",
    "src/lib/mongodb",
    "src/lib/zoom",
    "src/lib/ai",
    "src/lib/payments",
    "src/lib/email",
    "src/lib/whatsapp",
    "src/models",
    "src/services",
    "src/validations",
    "src/types",
    "src/utils"
)
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
New-Item -ItemType File -Force -Path "src/middleware.ts" | Out-Null
