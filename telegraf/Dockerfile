FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY mqtt_to_timescaledb.py .

# Create certs directory
RUN mkdir -p /app/certs

CMD ["python", "-u", "mqtt_to_timescaledb.py"]
