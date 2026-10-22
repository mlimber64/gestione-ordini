package it.limber.notification.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Abilita i compiti programmati (oggi la pulizia notturna delle notifiche vecchie). */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
class SchedulingConfig {

}
