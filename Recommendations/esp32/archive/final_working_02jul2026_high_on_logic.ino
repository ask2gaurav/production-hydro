// Import required libraries
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <OneWire.h>
#include <ESPmDNS.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>

#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

#define HEATER 5
#define BLOWER 26
#define FLUSH 25
#define WATER_LEVEL_UP 19
#define WATER_LEVEL_BOTTOM 21
#define WATER_IN_S1 33
#define WATER_PUMP_OUT 32
#define FLUSH_BUTTON 27
#define POWER_ON 22
#define HARDWARE_PAUSE_RESUME_BUTTON 18
#define HARDWARE_LONG_PRESS_OFF_BUTTON 18
#define EXTRA_PIN 18

// Replace with your network credentials
const char* ssid = "Colonima8299";
const char* password = "iyst3y9ew";
const char* machineSerial = "COLONIMA-GJ05-2026-003";  // Hard-coded machine serial number
float readSensorTemperature = 0;

byte readLL, readLH, readButton, readHeader, readBlower, readFlush, readWaterInSq, readWaterPumpOut, readHeater;
byte prepSession=0, startSession=0, sessionPause=0, sessionEnd=0;
byte flushAuto,  flushButtonHit, flushButtonHitFromTab=0, flushButtonHardwareHit=0, flushButtonHardwareHitPrev=0;
byte blowerAuto,  blowerButtonHit;
byte  flushFreqMode=0, blowerFreqMode=0; // 0 for continuous, 1 for interval based
const byte MY_ON = LOW;
const byte MY_OFF = HIGH;

unsigned long sessionDuration, flushDuration, flushInterval, blowerDuration, blowerInterval;
unsigned long previousMillis=0, previousSessionMillis=0, previousFlushMillis=0;
unsigned long previousBlowerIntervalMillis=0, previousBlowerMillis=0;
unsigned long previousRegistrationMillis=0;
const unsigned long REGISTRATION_INTERVAL = 1000;  // 1 seconds
int registrationFailCount = 0;
int disconnectCount = 0;
int outputPins[] = {HEATER, BLOWER, FLUSH, WATER_IN_S1, WATER_PUMP_OUT, POWER_ON};
int inputPins[] = {WATER_LEVEL_UP, WATER_LEVEL_BOTTOM, FLUSH_BUTTON};
int inputPinsLen = sizeof(inputPins) / sizeof(inputPins[0]);
int outputPinsLen = sizeof(outputPins) / sizeof(outputPins[0]);
int setTemperature = 35, maxTemperature = 45;
 
// Hardware button (pin 18) state tracking
byte hwButtonPrevState = MY_ON;
unsigned long hwButtonPressStart = 0;
bool hwButtonLongPressFired = false;
const unsigned long LONG_PRESS_DURATION = 5000;  // 5 seconds

// Create AsyncWebServer object on port 80
AsyncWebServer server(8091);

// Send registration POST to the app server running on the gateway (mobile hotspot) at port 8765
// Body: {"ip":"<esp32_ip>","serial":"<machineSerial>"}
bool registerWithServer() {
	if (WiFi.status() != WL_CONNECTED) return false;
	String esp32Ip = WiFi.localIP().toString();
	String gatewayIp = WiFi.gatewayIP().toString();
	String url = "http://" + gatewayIp + ":8765/register";
	String body = "{\"ip\":\"" + esp32Ip + "\",\"serial\":\"" + String(machineSerial) + "\"}";
	HTTPClient http;
	http.begin(url);
	http.addHeader("Content-Type", "application/json");
	int httpCode = http.POST(body);
	http.end();
	return (httpCode >= 200 && httpCode < 300);
}

// Initialize hardware pause/resume and long-press-off button (pin 18)
void init_hardware_button() {
	pinMode(HARDWARE_PAUSE_RESUME_BUTTON, INPUT);
	hwButtonPrevState = digitalRead(HARDWARE_PAUSE_RESUME_BUTTON);
	hwButtonLongPressFired = false;
}

// Handle short press (toggle pause) and long press (end session) on pin 18
void handle_hardware_button() {
	byte currentState = digitalRead(HARDWARE_PAUSE_RESUME_BUTTON);

	// Button just pressed
	if (currentState == MY_OFF && hwButtonPrevState == MY_ON) {
		hwButtonPressStart = millis();
		hwButtonLongPressFired = false;
		delay (500);
		}

	// Button held — check for long press threshold
	
	if (currentState == MY_ON && hwButtonLongPressFired) {
			if (millis() - hwButtonPressStart >= LONG_PRESS_DURATION) {
			hwButtonLongPressFired = true;
			startSession = 0;
			prepSession = 0;
			sessionPause = 0;
			sessionEnd = 0;
			END_SESSION();
	}
	
		
		else{
			RESUME_SESSION();
		}
}
	// Button just released
	if (currentState == MY_OFF && hwButtonPrevState == MY_ON) {
		if (!hwButtonLongPressFired && startSession == 1) {
			sessionPause = (sessionPause == 0) ? 1 : 0;
		
		}
	
	}
	hwButtonPrevState == currentState;
}

void setup() {
	// Serial port for debugging purposes
	//Serial.begin(115200);
	reset_pins();
	init_hardware_button();
	flushButtonHardwareHit = digitalRead(FLUSH_BUTTON);
	flushButtonHardwareHitPrev = flushButtonHardwareHit;
	// Connect to Wi-Fi
	WiFi.mode(WIFI_STA);
	WiFi.begin(ssid, password);
		while (WiFi.status() != WL_CONNECTED) {
		delay(1000);
	}

	registerWithServer();

	if (!MDNS.begin("advaithydro")) {  // Set hostname to "advaithydro"
		while (1) { delay(1000); }
	}
	MDNS.addService("_http", "_tcp", 8091);

	sensors.begin();

	// Route for root / web page
	server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
		String outputMessage = "{\"temp\": " + String(readSensorTemperature) + ", \"water_hl\": " + String(readLH) + ", \"water_ll\": " + String(readLL) + ", \"blower\": " + String(readBlower) + ", \"flush_valve\": " + String(readFlush) + ", \"water_in_valve\": " + String(readWaterInSq) + ", \"pump\": " + String(readWaterPumpOut) + ", \"flush_button_hardware\": " + String(flushButtonHardwareHit) + ",\"heater\": " + String(readHeater) + "}";
		request->send(200, "text/html", outputMessage);
	});

	server.on("/machineinfo.html", HTTP_GET, [](AsyncWebServerRequest* request) {
		disconnectCount = 0;
		if (request->hasParam("session_duration") ) {
			sessionDuration = request->getParam("session_duration")->value().toInt();
		}
		if (request->hasParam("default_temperature") ) {
			setTemperature = request->getParam("default_temperature")->value().toInt();
		}
		if (request->hasParam("max_temperature") ) {
			maxTemperature = request->getParam("max_temperature")->value().toInt();
		}
		if (request->hasParam("auto_flush") ) {
			flushAuto = request->getParam("auto_flush")->value().toInt();
		}
		if (request->hasParam("flush_mode") ) {
			flushFreqMode = request->getParam("flush_mode")->value().toInt();
		}
		if (request->hasParam("flush_frequency") ) {
			flushInterval = request->getParam("flush_frequency")->value().toInt();
		}
		if (request->hasParam("flush_duration") ) {
			flushDuration = request->getParam("flush_duration")->value().toInt();
		}
		if (request->hasParam("flush_button_hit") ) {
			flushButtonHitFromTab = request->getParam("flush_button_hit")->value().toInt();
		}
		if (request->hasParam("flush_valve") ) {
			flushButtonHitFromTab = request->getParam("flush_valve")->value().toInt();
		}
		if (request->hasParam("blower_auto") ) {
			blowerAuto = request->getParam("blower_auto")->value().toInt();
		}
		if (request->hasParam("blower_frequency_mode") ) {
			blowerFreqMode = request->getParam("blower_frequency_mode")->value().toInt();
		}
		if (request->hasParam("blower_interval") ) {
			blowerInterval = request->getParam("blower_interval")->value().toInt();
		}
		if (request->hasParam("blower_duration") ) {
			blowerDuration = request->getParam("blower_duration")->value().toInt();
		}
		if (request->hasParam("blower") ) {
			blowerButtonHit = request->getParam("blower")->value().toInt();
		}
		if (request->hasParam("prepare_session") ) {
			prepSession = request->getParam("prepare_session")->value().toInt();
		}
		if (request->hasParam("start_session") ) {
			startSession = request->getParam("start_session")->value().toInt();
		}
		if (request->hasParam("pause_session") ) {
			sessionPause = request->getParam("pause_session")->value().toInt();
		}
		if (request->hasParam("end_session") ) {
			sessionEnd = request->getParam("end_session")->value().toInt();
		}

		read_pins();
		String outputMessage = "{\"temp\": " + String(readSensorTemperature) + ", \"water_hl\": " + String(readLH) + ", \"water_ll\": " + String(readLL) + ", \"blower\": " + String(blowerButtonHit) + ", \"flush_valve\": " + String(flushButtonHitFromTab) + ", \"water_in_valve\": " + String(readWaterInSq) + ", \"pump\": " + String(readWaterPumpOut) + ", \"flush_button_hardware\": " + String(flushButtonHardwareHit) + ",\"heater\": " + String(readHeater) + "}";

		AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", outputMessage);
		response->addHeader("Access-Control-Allow-Origin", "*");
		response->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
		response->addHeader("Access-Control-Allow-Headers", "Content-Type");
		response->addHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
		request->send(response);
	});

	// Start server
	server.begin();
	DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
	DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
	DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");
	DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
}

void read_pins(){
	readLL = digitalRead(WATER_LEVEL_BOTTOM);
	readLH = digitalRead(WATER_LEVEL_UP);
	flushButtonHardwareHit = digitalRead(FLUSH_BUTTON);
	readBlower = digitalRead(BLOWER);
	readFlush = digitalRead(FLUSH);
	readWaterInSq = digitalRead(WATER_IN_S1);
	readWaterPumpOut = digitalRead(WATER_PUMP_OUT);
	readHeater = digitalRead(HEATER);
}

//reset all input and output pins to default state
void reset_pins(){
	for (int i = 0; i < inputPinsLen; i++) {
		pinMode(inputPins[i], INPUT);
	}
	for (int i = 0; i < outputPinsLen; i++) {
		pinMode(outputPins[i], OUTPUT);
		digitalWrite(outputPins[i], MY_ON); // set all pins as off by default except heater
		
		//digitalWrite(HEATER, MY_OFF); // keep heater off at startup
	}
	flushDuration=10; flushInterval=30; sessionPause=0; sessionDuration=0; flushButtonHit=0;
}

//flush button logic
void fnFlushAuto(unsigned long flushInterval){
	if (flushAuto == 1 && startSession == 1 ){
		unsigned long currentMillis = millis();
		flushInterval = flushInterval*1000;
		if (currentMillis - previousFlushMillis >= flushInterval){
			previousFlushMillis  = currentMillis;
			if(flushButtonHit == 0){
				flushButtonHit=1;
			}else{
				flushButtonHit=0;
			}
		}
	}
}
void fnFlushButtonHitInterval(unsigned long flushDuration){
	unsigned long currentMillis = millis();
	flushDuration = flushDuration*1000;
	if (currentMillis - previousMillis >= flushDuration){
		previousMillis  = currentMillis;
		byte pinCheckAndSet = digitalRead(FLUSH);
		if (pinCheckAndSet == MY_ON){
			pinCheckAndSet = MY_OFF;
		} else {
			pinCheckAndSet = MY_ON;
		}
		digitalWrite(FLUSH, pinCheckAndSet);
		flushButtonHit = flushButtonHit+1;
	}
	if(flushButtonHit > 2){
		flushButtonHit = 0;
	}
}

//blower button logic
void fnBlowerAuto(unsigned long blowerInterval){
	if (blowerAuto == 1 && startSession == 1 ){
		unsigned long currentMillis = millis();
		blowerInterval = blowerInterval*1000;
		if (currentMillis - previousBlowerMillis >= blowerInterval){
			previousBlowerMillis  = currentMillis;
			if(blowerButtonHit == 0){
				blowerButtonHit=1;
			}else{
				blowerButtonHit=0;
			}
		}
	}
}
void fnBlowerButtonHitInterval(unsigned long blowerDuration){
	unsigned long currentMillis = millis();
	blowerDuration = blowerDuration*1000;
	if (currentMillis - previousBlowerIntervalMillis >= blowerDuration){
		previousBlowerIntervalMillis  = currentMillis;
		byte blowerState = digitalRead(BLOWER);
		if (blowerState == MY_ON){
			blowerState = MY_OFF;
		} else {
			blowerState = MY_ON;
		}
		digitalWrite(BLOWER, blowerState);
		blowerButtonHit = blowerButtonHit+1;
	}
	if(blowerButtonHit > 2){
		blowerButtonHit = 0;
	}
}

void PREPARE_SESSION(){
	//if water low level is reached then only start heater
	if (readLL == MY_OFF){
		if (readSensorTemperature <= setTemperature){
			digitalWrite(HEATER, MY_OFF);
		}
		else{
			digitalWrite(HEATER, MY_ON);
		}
	}else{
		digitalWrite(WATER_IN_S1, MY_OFF);
		digitalWrite(HEATER, MY_ON);
		digitalWrite(WATER_PUMP_OUT, MY_ON);
	}
	if (readLH == MY_ON || readLL == MY_ON){
		digitalWrite(WATER_IN_S1, MY_OFF);
	}else{
		digitalWrite(WATER_IN_S1, MY_ON);
	}
}

void START_SESSION(){
	//blower settings
	if(blowerAuto == 1){
		if(blowerFreqMode == 1){
			if(blowerInterval > blowerDuration){
				fnBlowerAuto(blowerInterval);
				if(blowerButtonHit > 0){
					fnBlowerButtonHitInterval(blowerDuration);
				}
			}else{
				fnBlowerButtonHitInterval(blowerDuration);
			}
		}else{
			digitalWrite(BLOWER, MY_OFF);	//turn ON blower in continuous mode
		}
	}else{
		if(blowerFreqMode == 1){
			if(blowerButtonHit > 0){
				fnBlowerButtonHitInterval(blowerDuration);
			}
		}else{
			if(blowerButtonHit == 0){
				digitalWrite(BLOWER, MY_ON);	//turn off the blower if auto blower is not selected
			}else{
				digitalWrite(BLOWER, MY_OFF);	//turn ON blower if blower button is hit but auto blower is not selected
			}
		}
	}

	//flush settings
	if(flushAuto == 1){
		if(flushFreqMode == 1){
			if(flushButtonHitFromTab == 1){
				flushButtonHitFromTab=0;
				flushButtonHit=1;
				fnFlushButtonHitInterval(flushDuration);
			}
			if(flushInterval>flushDuration){
				fnFlushAuto(flushInterval);
				if(flushButtonHit > 0){
					fnFlushButtonHitInterval(flushDuration);
				}
			}else{
				fnFlushButtonHitInterval(flushDuration);
			}
		}else{
			digitalWrite(FLUSH, MY_OFF);	//turn ON flush in continuous mode
		}
	}else{
		if(flushFreqMode == 1){ //non auto frequency mode, flush will work based on the interval set by user
			if(flushButtonHitFromTab == 1){
				flushButtonHit=1;
				flushButtonHitFromTab=0;
				fnFlushButtonHitInterval(flushDuration);
			}
			if(flushButtonHit > 0){
				fnFlushButtonHitInterval(flushDuration);
			}
		}else{	//non auto continuous mode, flush button will work as a toggle switch
			if(flushButtonHitFromTab == 0){
				digitalWrite(FLUSH, MY_ON);	//turn off the flush if auto flush is not selected
			}else{
				if(flushButtonHitFromTab == 1){
					digitalWrite(FLUSH, MY_OFF);	//turn ON flush if flush button is hit but auto flush is not selected
				}
			}
		}
	}
	if(readLL == MY_OFF){
		digitalWrite(WATER_PUMP_OUT, MY_OFF);
	}else{
		digitalWrite(WATER_PUMP_OUT, MY_ON);
	}
}

void PAUSE_SESSION(){
	digitalWrite(WATER_PUMP_OUT, MY_ON);
}
void RESUME_SESSION(){
	if(readLL == MY_OFF){
		digitalWrite(WATER_PUMP_OUT, MY_OFF);
	}
}
void END_SESSION(){
	for (int i = 0; i < outputPinsLen; i++) {
		
			digitalWrite(outputPins[i], MY_ON); // set all pins as off by default except power pins
		
		
	}
}

void loop() {
	unsigned long currentMillis = millis();
	if (currentMillis - previousRegistrationMillis >= REGISTRATION_INTERVAL) {
		previousRegistrationMillis = currentMillis;
		disconnectCount++;
		bool regOk = registerWithServer();
		if (regOk) {
			registrationFailCount = 0;
			disconnectCount = 0;
		} else {
			registrationFailCount++;
			if (startSession == 1) {
				sessionPause = 1;
			}
			if (registrationFailCount >= 5) {
				sessionEnd = 1;
			}
		}
		if(disconnectCount >= 2){
			sessionPause = 1;
		}
		if(disconnectCount >= 5){
			sessionEnd = 1;
		}
	}

	sensors.requestTemperatures();
	readSensorTemperature = sensors.getTempCByIndex(0);

	read_pins();
	if(prepSession == 1){
		PREPARE_SESSION();
	}
	if(startSession == 1){
		START_SESSION();
		if(sessionPause == 1){
			PAUSE_SESSION();
		}else{
			RESUME_SESSION();
		}
	}
	if(sessionEnd == 1){
		startSession=0;
		prepSession=0;
		sessionEnd=0;
		sessionPause=0;
		END_SESSION();
	}

	handle_hardware_button();

	flushButtonHardwareHit = digitalRead(FLUSH_BUTTON);
	if(flushButtonHardwareHit == 1 && flushButtonHardwareHitPrev != flushButtonHardwareHit){
		flushButtonHardwareHitPrev = flushButtonHardwareHit;
		digitalWrite(FLUSH, MY_OFF);
		flushButtonHitFromTab = -1;
		flushButtonHit = 0;
	}else{
		if(flushButtonHardwareHit == 0 && flushButtonHardwareHitPrev != flushButtonHardwareHit){
			flushButtonHardwareHitPrev = flushButtonHardwareHit;
			digitalWrite(FLUSH, MY_ON);
			if(flushAuto == 0 && flushFreqMode == 0){
				flushButtonHitFromTab = -1;
				flushButtonHit = 0;
			}
		}
	}
}