-- CreateTable
CREATE TABLE "MqttConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "broker" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 1883,
    "clientId" TEXT NOT NULL DEFAULT 'storage_telegraf',
    "username" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL DEFAULT '',
    "keepAlive" INTEGER NOT NULL DEFAULT 60,
    "tlsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tlsInsecure" BOOLEAN NOT NULL DEFAULT false,
    "caCertPath" TEXT,
    "topicPatterns" TEXT[] DEFAULT ARRAY['bacnet/#']::TEXT[],
    "qos" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastConnected" TIMESTAMP(3),
    "connectionStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MqttConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- Insert default records
INSERT INTO "MqttConfig" ("id", "updatedAt") VALUES (1, NOW()) ON CONFLICT DO NOTHING;
INSERT INTO "SystemSettings" ("id", "updatedAt") VALUES (1, NOW()) ON CONFLICT DO NOTHING;
