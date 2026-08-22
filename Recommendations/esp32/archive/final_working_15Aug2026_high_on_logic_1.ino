// Import required libraries
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <OneWire.h>
#include <ESPmDNS.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <OneButton.h>
#include "esp_log.h"

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

OneButton button(HARDWARE_PAUSE_RESUME_BUTTON, true);

// Replace with your network credentials
const char* ssid = "Colonima7092";
const char* password = "04n7khslc";
const char* machineSerial = "DEL_TEST11";  // Hard-coded machine serial number
float readSensorTemperature = 0;

byte readLL, readLH, readButton, readHeader, readBlower, readFlush, readWaterInSq, readWaterPumpOut, readHeater;
byte prepSession=0, startSession=0, sessionPause=0, sessionEnd=0, hardwareSessionEnd=0;
byte flushAuto,  flushButtonHit, flushButtonHitFromTab=0, flushButtonHardwareHit=0, flushButtonHardwareHitPrev=0;
byte blowerAuto,  blowerButtonHit;
byte  flushFreqMode=0, blowerFreqMode=0; // 0 for continuous, 1 for interval based
byte heater_from_app=2; // 0 for off, 1 for on
const byte MY_OFF = LOW;
const byte MY_ON = HIGH;

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
byte hwButtonPrevState = MY_OFF;
unsigned long hwButtonPressStart = 0;
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

// Callback function for a short click
void handleClick() {
	if (startSession == 1 && sessionPause == 0) {
		//pause session
		PAUSE_SESSION();
		sessionPause = 1;
		
	} else {
		//resume session
		sessionPause = 0;
		RESUME_SESSION();
	}
}

// Callback function for a long press
void handleLongPress() {
	//if(button.isLongPressed()==true){
		startSession = 0;
		prepSession = 0;
		sessionPause = 0;
		sessionEnd = 0;
		hardwareSessionEnd=1;
		END_SESSION();
		
	//}
	button.reset();
}

void setup() {
	// Suppress ESP-IDF/Arduino-core internal logging (WiFi events, peripheral manager, etc.)
	// at runtime, regardless of the IDE's Core Debug Level build setting — that logging
	// writes to the same Serial/UART0 the USB-C command channel uses and corrupts the
	// strict one-JSON-line-per-command protocol below. Must run before WiFi/Serial start.
	esp_log_level_set("*", ESP_LOG_NONE);

	// Serial port — used for the USB-C command channel (see pollSerialCommands()),
	// not just debugging, so nothing else may write to Serial.
	Serial.begin(115200);
	reset_pins();
	flushButtonHardwareHit = digitalRead(FLUSH_BUTTON);
	flushButtonHardwareHitPrev = flushButtonHardwareHit;
	// Connect to Wi-Fi
	WiFi.mode(WIFI_STA);
	WiFi.begin(ssid, password);
	// Service USB serial commands while (re)connecting — opening the USB port commonly
	// resets the board via DTR/RTS, so the app may be polling over USB right here.
	while (WiFi.status() != WL_CONNECTED) {
		pollSerialCommands();
		delay(50);
	}

	registerWithServer();

	if (!MDNS.begin("advaithydro")) {  // Set hostname to "advaithydro"
		while (1) { delay(1000); }
	}
	MDNS.addService("_http", "_tcp", 8091);

	sensors.begin();

	// 1. Link the function to trigger on a quick short click
  button.attachClick(handleClick);
  // 2. Link the function to trigger as soon as the long press threshold is crossed
  button.attachLongPressStart(handleLongPress);
  // Optional: Adjust the long press duration threshold (defaults to 600ms)
	button.setClickMs(50);
  button.setPressMs(5000); // Set to 1000ms (1 seconds)

	// Route for root / web page
	server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
		String outputMessage = "{\"temp\": " + String(readSensorTemperature) + ", \"water_hl\": " + String(readLH) + ", \"water_ll\": " + String(readLL) + ", \"blower\": " + String(readBlower) + ", \"flush_valve\": " + String(readFlush) + ", \"water_in_valve\": " + String(readWaterInSq) + ", \"pump\": " + String(readWaterPumpOut) + ", \"flush_button_hardware\": " + String(flushButtonHardwareHit) + ",\"heater\": " + String(readHeater) + ",\"sessionP\": " + String( sessionPause ) + ",\"hes\": " + String(0) + "}";
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
		if (request->hasParam("heater") ) {
			heater_from_app = request->getParam("heater")->value().toInt();
			if(heater_from_app == 1){
				digitalWrite(HEATER, MY_ON);
			}
			else if(heater_from_app == 0){
				digitalWrite(HEATER, MY_OFF);
			}
			heater_from_app=2;
		}

		read_pins();
		String outputMessage = "{\"temp\": " + String(readSensorTemperature) + ", \"water_hl\": " + String(readLH) + ", \"water_ll\": " + String(readLL) + ", \"blower\": " + String(blowerButtonHit) + ", \"flush_valve\": " + String(flushButtonHitFromTab) + ", \"water_in_valve\": " + String(readWaterInSq) + ", \"pump\": " + String(readWaterPumpOut) + ", \"flush_button_hardware\": " + String(flushButtonHardwareHit) + ",\"heater\": " + String(readHeater) + ",\"sessionP\": " + String( sessionPause ) + ",\"hes\": " + String(0) + "}";

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

// ---- USB-C / Serial command channel ----
// Mirrors the /machineinfo.html HTTP handler above (same param names, same JSON
// response shape) but reads/writes over Serial instead of the AsyncWebServer.
// Kept fully separate from the WiFi handler so that path is never touched by this.
String serialBuffer = "";

// Applies one key=value pair from a serial command line to the same globals the
// WiFi /machineinfo.html handler uses. Unknown keys (including the app's plain-poll
// marker "poll=1") are silently ignored.
void applySerialParam(String key, String value) {
	if (key == "session_duration") sessionDuration = value.toInt();
	else if (key == "default_temperature") setTemperature = value.toInt();
	else if (key == "max_temperature") maxTemperature = value.toInt();
	else if (key == "auto_flush") flushAuto = value.toInt();
	else if (key == "flush_mode") flushFreqMode = value.toInt();
	else if (key == "flush_frequency") flushInterval = value.toInt();
	else if (key == "flush_duration") flushDuration = value.toInt();
	else if (key == "flush_button_hit") flushButtonHitFromTab = value.toInt();
	else if (key == "flush_valve") flushButtonHitFromTab = value.toInt();
	else if (key == "blower_auto") blowerAuto = value.toInt();
	else if (key == "blower_frequency_mode") blowerFreqMode = value.toInt();
	else if (key == "blower_interval") blowerInterval = value.toInt();
	else if (key == "blower_duration") blowerDuration = value.toInt();
	else if (key == "blower") blowerButtonHit = value.toInt();
	else if (key == "prepare_session") prepSession = value.toInt();
	else if (key == "start_session") startSession = value.toInt();
	else if (key == "pause_session") sessionPause = value.toInt();
	else if (key == "end_session") sessionEnd = value.toInt();
	else if (key == "heater") {
		heater_from_app = value.toInt();
		if (heater_from_app == 1) {
			digitalWrite(HEATER, MY_ON);
		} else if (heater_from_app == 0) {
			digitalWrite(HEATER, MY_OFF);
		}
		heater_from_app = 2;
	}
}

// Parses "key1=val1&key2=val2" (no leading '?'), applies each param, then returns
// the same status JSON line the WiFi /machineinfo.html handler builds.
String handleSerialCommand(String line) {
	disconnectCount = 0;
	int start = 0;
	String keyValue;
	while (start < (int)line.length()) {
		int amp = line.indexOf('&', start);
		String pair = (amp == -1) ? line.substring(start) : line.substring(start, amp);
		int eq = pair.indexOf('=');
		if (eq > 0) {
			keyValue += pair.substring(0, eq) + "=" + pair.substring(eq + 1);
			applySerialParam(pair.substring(0, eq), pair.substring(eq + 1));
		}
		if (amp == -1) break;
		start = amp + 1;
	}

	read_pins();
	return "{\"debug_serial_cmd\": \"" + keyValue + "\",\"temp\": " + String(readSensorTemperature) + ", \"water_hl\": " + String(readLH) + ", \"water_ll\": " + String(readLL) + ", \"blower\": " + String(blowerButtonHit) + ", \"flush_valve\": " + String(flushButtonHitFromTab) + ", \"water_in_valve\": " + String(readWaterInSq) + ", \"pump\": " + String(readWaterPumpOut) + ", \"flush_button_hardware\": " + String(flushButtonHardwareHit) + ",\"heater\": " + String(readHeater) + ",\"sessionP\": " + String( sessionPause ) + ",\"hes\": " + String(0) + "}";
}

// Non-blocking: drains whatever bytes are available, processes one command per
// complete newline-terminated line, and writes exactly one JSON reply per line.
void pollSerialCommands() {
	while (Serial.available() > 0) {
		char c = (char)Serial.read();
		if (c == '\n') {
			serialBuffer.trim();
			if (serialBuffer.length() > 0) {
				Serial.println(handleSerialCommand(serialBuffer));
			}
			serialBuffer = "";
		} else if (c != '\r') {
			serialBuffer += c;
			if (serialBuffer.length() > 256) serialBuffer = ""; // guard against a garbled/unterminated line
		}
	}
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
		digitalWrite(outputPins[i], MY_OFF); // set all pins as off by default except heater
		
		//digitalWrite(HEATER, MY_ON); // keep heater off at startup
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
		if (pinCheckAndSet == MY_OFF){
			pinCheckAndSet = MY_ON;
		} else {
			pinCheckAndSet = MY_OFF;
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
		if (blowerState == MY_OFF){
			blowerState = MY_ON;
		} else {
			blowerState = MY_OFF;
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
	if (readLL == MY_ON){
		if (readSensorTemperature <= setTemperature){
			digitalWrite(HEATER, MY_ON);
		}
		else{
			digitalWrite(HEATER, MY_OFF);
		}
	}else{
		digitalWrite(WATER_IN_S1, MY_ON);
		digitalWrite(HEATER, MY_OFF);
		digitalWrite(WATER_PUMP_OUT, MY_OFF);
	}
	if (readLH == MY_OFF || readLL == MY_OFF){
		digitalWrite(WATER_IN_S1, MY_ON);
	}else{
		digitalWrite(WATER_IN_S1, MY_OFF);
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
			digitalWrite(BLOWER, MY_ON);	//turn ON blower in continuous mode
		}
	}else{
		if(blowerFreqMode == 1){
			if(blowerButtonHit > 0){
				fnBlowerButtonHitInterval(blowerDuration);
			}
		}else{
			if(blowerButtonHit == 0){
				digitalWrite(BLOWER, MY_OFF);	//turn off the blower if auto blower is not selected
			}else{
				digitalWrite(BLOWER, MY_ON);	//turn ON blower if blower button is hit but auto blower is not selected
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
			digitalWrite(FLUSH, MY_ON);	//turn ON flush in continuous mode
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
				digitalWrite(FLUSH, MY_OFF);	//turn off the flush if auto flush is not selected
			}else{
				if(flushButtonHitFromTab == 1){
					digitalWrite(FLUSH, MY_ON);	//turn ON flush if flush button is hit but auto flush is not selected
				}
			}
		}
	}
	if(readLL == MY_ON){
		digitalWrite(WATER_PUMP_OUT, MY_ON);
	}else{
		digitalWrite(WATER_PUMP_OUT, MY_OFF);
	}

	if (readSensorTemperature > maxTemperature){
		digitalWrite(HEATER, MY_OFF);
		PAUSE_SESSION();
	}
}

void PAUSE_SESSION(){
	digitalWrite(WATER_PUMP_OUT, MY_OFF);
}
void RESUME_SESSION(){
	if(readLL == MY_ON){
		digitalWrite(WATER_PUMP_OUT, MY_ON);
	}
}
void END_SESSION(){
	for (int i = 0; i < outputPinsLen; i++) {
			digitalWrite(outputPins[i], MY_OFF); // set all pins as off by default except power pins
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

	button.tick();

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

	flushButtonHardwareHit = digitalRead(FLUSH_BUTTON);
	if(flushButtonHardwareHit == 1 && flushButtonHardwareHitPrev != flushButtonHardwareHit){
		flushButtonHardwareHitPrev = flushButtonHardwareHit;
		digitalWrite(FLUSH, MY_ON);
		flushButtonHitFromTab = -1;
		flushButtonHit = 0;
	}else{
		if(flushButtonHardwareHit == 0 && flushButtonHardwareHitPrev != flushButtonHardwareHit){
			flushButtonHardwareHitPrev = flushButtonHardwareHit;
			digitalWrite(FLUSH, MY_OFF);
			if(flushAuto == 0 && flushFreqMode == 0){
				flushButtonHitFromTab = -1;
				flushButtonHit = 0;
			}
		}
	}

	pollSerialCommands();
}