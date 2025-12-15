#!/usr/bin/env python3
"""
Storage App - MQTT to TimescaleDB Bridge
Subscribes to MQTT topics and writes sensor data to TimescaleDB
Supports TLS/SSL and username/password authentication
"""

import os
import ssl
import json
import time
import logging
from datetime import datetime
import paho.mqtt.client as mqtt
import psycopg2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuration from environment - TimescaleDB
TIMESCALE_HOST = os.getenv('TIMESCALE_HOST', 'timescaledb')
TIMESCALE_PORT = int(os.getenv('TIMESCALE_PORT', '5432'))
TIMESCALE_DB = os.getenv('TIMESCALE_DB', 'sensor_data')
TIMESCALE_USER = os.getenv('TIMESCALE_USER', 'timescale')
TIMESCALE_PASSWORD = os.getenv('TIMESCALE_PASSWORD', 'timescale123')

# Configuration from environment - Config database
CONFIG_DB_HOST = os.getenv('CONFIG_DB_HOST', 'postgres')
CONFIG_DB_PORT = int(os.getenv('CONFIG_DB_PORT', '5432'))
CONFIG_DB_NAME = os.getenv('CONFIG_DB_NAME', 'storage_config')
CONFIG_DB_USER = os.getenv('CONFIG_DB_USER', 'storage')
CONFIG_DB_PASSWORD = os.getenv('CONFIG_DB_PASSWORD', 'storage123')

# MQTT Configuration (loaded from database)
mqtt_config = {
    'broker': '',
    'port': 1883,
    'client_id': 'storage_telegraf',
    'username': '',
    'password': '',
    'tls_enabled': False,
    'tls_insecure': False,
    'ca_cert_path': None,
    'topic_patterns': ['bacnet/#'],
    'qos': 1,
    'enabled': False
}

# Database connections
timescale_conn = None
config_conn = None

# MQTT client
mqtt_client = None
mqtt_connected = False

# Statistics
stats = {
    'messages_received': 0,
    'messages_written': 0,
    'errors': 0
}

# Deduplication cache
seen_messages = {}


def connect_config_db():
    """Connect to configuration database"""
    global config_conn
    try:
        config_conn = psycopg2.connect(
            host=CONFIG_DB_HOST,
            port=CONFIG_DB_PORT,
            database=CONFIG_DB_NAME,
            user=CONFIG_DB_USER,
            password=CONFIG_DB_PASSWORD,
            connect_timeout=10
        )
        config_conn.autocommit = True
        logger.info(f"Connected to config database at {CONFIG_DB_HOST}:{CONFIG_DB_PORT}")
        return True
    except Exception as e:
        logger.error(f"Failed to connect to config database: {e}")
        return False


def load_mqtt_config():
    """Load MQTT configuration from database"""
    global mqtt_config, config_conn
    try:
        cursor = config_conn.cursor()
        cursor.execute('''
            SELECT broker, port, "clientId", username, password,
                   "tlsEnabled", "tlsInsecure", "caCertPath",
                   "topicPatterns", qos, enabled
            FROM "MqttConfig"
            WHERE id = 1
            LIMIT 1
        ''')
        result = cursor.fetchone()
        cursor.close()

        if result:
            mqtt_config['broker'] = result[0] or ''
            mqtt_config['port'] = result[1] or 1883
            mqtt_config['client_id'] = result[2] or 'storage_telegraf'
            mqtt_config['username'] = result[3] or ''
            mqtt_config['password'] = result[4] or ''
            mqtt_config['tls_enabled'] = result[5] or False
            mqtt_config['tls_insecure'] = result[6] or False
            mqtt_config['ca_cert_path'] = result[7]
            mqtt_config['topic_patterns'] = result[8] or ['bacnet/#']
            mqtt_config['qos'] = result[9] or 1
            mqtt_config['enabled'] = result[10] if result[10] is not None else True

            logger.info(f"Loaded MQTT config: {mqtt_config['broker']}:{mqtt_config['port']}")
            logger.info(f"  TLS: {mqtt_config['tls_enabled']}, Auth: {bool(mqtt_config['username'])}")
            logger.info(f"  Topics: {mqtt_config['topic_patterns']}")
            return True
        else:
            logger.warning("No MQTT config found in database")
            return False
    except Exception as e:
        logger.error(f"Failed to load MQTT config: {e}")
        return False


def update_connection_status(status: str, last_connected: bool = False):
    """Update MQTT connection status in database"""
    global config_conn
    try:
        cursor = config_conn.cursor()
        if last_connected:
            cursor.execute('''
                UPDATE "MqttConfig"
                SET "connectionStatus" = %s, "lastConnected" = NOW(), "updatedAt" = NOW()
                WHERE id = 1
            ''', (status,))
        else:
            cursor.execute('''
                UPDATE "MqttConfig"
                SET "connectionStatus" = %s, "updatedAt" = NOW()
                WHERE id = 1
            ''', (status,))
        cursor.close()
    except Exception as e:
        logger.error(f"Failed to update connection status: {e}")


def connect_timescale_db():
    """Connect to TimescaleDB"""
    global timescale_conn
    try:
        timescale_conn = psycopg2.connect(
            host=TIMESCALE_HOST,
            port=TIMESCALE_PORT,
            database=TIMESCALE_DB,
            user=TIMESCALE_USER,
            password=TIMESCALE_PASSWORD,
            connect_timeout=10
        )
        timescale_conn.autocommit = True
        logger.info(f"Connected to TimescaleDB at {TIMESCALE_HOST}:{TIMESCALE_PORT}")
        return True
    except Exception as e:
        logger.error(f"Failed to connect to TimescaleDB: {e}")
        return False


def on_connect(client, userdata, flags, reason_code, properties):
    """Callback when connected to MQTT broker"""
    global mqtt_connected
    if reason_code == 0:
        mqtt_connected = True
        logger.info(f"Connected to MQTT broker {mqtt_config['broker']}:{mqtt_config['port']}")
        update_connection_status('connected', last_connected=True)

        # Subscribe to configured topic patterns
        for pattern in mqtt_config['topic_patterns']:
            client.subscribe(pattern, qos=mqtt_config['qos'])
            logger.info(f"Subscribed to: {pattern}")
    else:
        mqtt_connected = False
        logger.error(f"Failed to connect to MQTT broker, code: {reason_code}")
        update_connection_status('error')


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    """Callback when disconnected from MQTT broker"""
    global mqtt_connected
    mqtt_connected = False
    if reason_code != 0:
        logger.warning(f"Unexpected disconnect from MQTT broker, code: {reason_code}")
    update_connection_status('disconnected')


def on_message(client, userdata, msg):
    """Callback when MQTT message received"""
    global stats, seen_messages

    try:
        stats['messages_received'] += 1

        # Parse JSON payload
        payload = json.loads(msg.payload.decode('utf-8'))

        # Extract timestamp
        timestamp = payload.get('timestamp')
        if timestamp:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        else:
            dt = datetime.utcnow()

        # Deduplication check
        haystack_name = payload.get('haystackName') or payload.get('haystack_name')
        timestamp_second = timestamp[:19] if timestamp and len(timestamp) >= 19 else str(dt)[:19]
        dedup_key = (haystack_name, timestamp_second)
        if dedup_key in seen_messages:
            return

        seen_messages[dedup_key] = True
        if len(seen_messages) > 1000:
            for _ in range(100):
                seen_messages.pop(next(iter(seen_messages)), None)

        # Prepare data for insertion
        data = {
            'time': dt,
            'site_id': payload.get('siteId'),
            'equipment_type': payload.get('equipmentType'),
            'equipment_id': payload.get('equipmentId'),
            'device_id': payload.get('deviceId', 0),
            'device_name': payload.get('deviceName'),
            'device_ip': payload.get('deviceIp'),
            'object_type': payload.get('objectType', 'unknown'),
            'object_instance': payload.get('objectInstance', 0),
            'point_id': payload.get('pointId'),
            'point_name': payload.get('pointName'),
            'haystack_name': haystack_name,
            'dis': payload.get('dis'),
            'value': payload.get('value'),
            'units': payload.get('units'),
            'quality': payload.get('quality', 'good'),
            'poll_duration': payload.get('pollDuration'),
            'poll_cycle': payload.get('pollCycle')
        }

        # Insert into TimescaleDB
        insert_sensor_reading(data)
        stats['messages_written'] += 1

        # Log progress every 10 messages
        if stats['messages_received'] % 10 == 0:
            logger.info(f"Stats: {stats['messages_received']} received, {stats['messages_written']} written, {stats['errors']} errors")

    except json.JSONDecodeError as e:
        stats['errors'] += 1
        logger.error(f"Invalid JSON in message: {e}")
    except Exception as e:
        stats['errors'] += 1
        logger.error(f"Error processing message: {e}")


def insert_sensor_reading(data):
    """Insert sensor reading into TimescaleDB"""
    global timescale_conn

    try:
        cursor = timescale_conn.cursor()

        sql = """
        INSERT INTO sensor_readings (
            time, site_id, equipment_type, equipment_id,
            device_id, device_name, device_ip,
            object_type, object_instance,
            point_id, point_name, haystack_name, dis,
            value, units, quality,
            poll_duration, poll_cycle
        ) VALUES (
            %(time)s, %(site_id)s, %(equipment_type)s, %(equipment_id)s,
            %(device_id)s, %(device_name)s, %(device_ip)s,
            %(object_type)s, %(object_instance)s,
            %(point_id)s, %(point_name)s, %(haystack_name)s, %(dis)s,
            %(value)s, %(units)s, %(quality)s,
            %(poll_duration)s, %(poll_cycle)s
        )
        """

        cursor.execute(sql, data)
        cursor.close()

    except Exception as e:
        logger.error(f"Database insert error: {e}")
        connect_timescale_db()


def connect_mqtt():
    """Connect to MQTT broker with TLS and authentication support"""
    global mqtt_client, mqtt_connected

    if not mqtt_config['broker']:
        logger.warning("MQTT broker not configured, waiting...")
        return False

    if not mqtt_config['enabled']:
        logger.info("MQTT is disabled in configuration")
        return False

    try:
        # Create MQTT client
        mqtt_client = mqtt.Client(
            client_id=mqtt_config['client_id'],
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            clean_session=True
        )
        mqtt_client.on_connect = on_connect
        mqtt_client.on_disconnect = on_disconnect
        mqtt_client.on_message = on_message
        mqtt_client.reconnect_delay_set(min_delay=1, max_delay=60)

        # Configure authentication
        if mqtt_config['username']:
            mqtt_client.username_pw_set(
                mqtt_config['username'],
                mqtt_config['password']
            )
            logger.info(f"MQTT authentication configured for user: {mqtt_config['username']}")

        # Configure TLS
        if mqtt_config['tls_enabled']:
            ca_cert = mqtt_config['ca_cert_path']

            if mqtt_config['tls_insecure']:
                # Insecure mode: skip certificate verification
                mqtt_client.tls_set(cert_reqs=ssl.CERT_NONE)
                mqtt_client.tls_insecure_set(True)
                logger.warning("TLS configured with INSECURE mode (certificate verification disabled)")
            else:
                # Secure mode: verify certificates
                if ca_cert:
                    if not os.path.exists(ca_cert):
                        logger.error(f"CA certificate file not found: {ca_cert}")
                        ca_cert = None
                    elif not os.access(ca_cert, os.R_OK):
                        logger.error(f"CA certificate file not readable: {ca_cert}")
                        ca_cert = None

                if ca_cert:
                    mqtt_client.tls_set(
                        ca_certs=ca_cert,
                        cert_reqs=ssl.CERT_REQUIRED,
                        tls_version=ssl.PROTOCOL_TLS
                    )
                    logger.info(f"TLS configured with CA certificate: {ca_cert}")
                else:
                    # Use system CA bundle
                    mqtt_client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
                    logger.info("TLS configured with system CA bundle")

        # Connect
        update_connection_status('connecting')
        mqtt_client.connect(mqtt_config['broker'], mqtt_config['port'], keepalive=60)
        mqtt_client.loop_start()

        # Wait for connection
        time.sleep(2)
        return mqtt_connected

    except Exception as e:
        logger.error(f"Failed to connect to MQTT broker: {e}")
        update_connection_status('error')
        return False


def main():
    """Main function"""
    logger.info(f"Starting Storage App MQTT to TimescaleDB bridge (PID: {os.getpid()})")

    # Connect to config database
    while not connect_config_db():
        logger.info("Waiting for config database...")
        time.sleep(5)

    # Connect to TimescaleDB
    while not connect_timescale_db():
        logger.info("Waiting for TimescaleDB...")
        time.sleep(5)

    # Main loop - poll for config changes and maintain MQTT connection
    last_config_check = 0
    config_check_interval = 30  # Check config every 30 seconds

    while True:
        current_time = time.time()

        # Check for config changes periodically
        if current_time - last_config_check > config_check_interval:
            last_config_check = current_time

            # Reload config
            old_broker = mqtt_config['broker']
            old_port = mqtt_config['port']
            old_tls = mqtt_config['tls_enabled']

            load_mqtt_config()

            # Check if config changed
            config_changed = (
                old_broker != mqtt_config['broker'] or
                old_port != mqtt_config['port'] or
                old_tls != mqtt_config['tls_enabled']
            )

            if config_changed and mqtt_client:
                logger.info("MQTT config changed, reconnecting...")
                mqtt_client.disconnect()
                mqtt_client.loop_stop()
                time.sleep(1)
                connect_mqtt()

        # Connect if not connected
        if not mqtt_connected and mqtt_config['broker'] and mqtt_config['enabled']:
            logger.info(f"Connecting to MQTT broker {mqtt_config['broker']}:{mqtt_config['port']}...")
            connect_mqtt()

        # Sleep before next iteration
        time.sleep(5)


if __name__ == "__main__":
    main()
