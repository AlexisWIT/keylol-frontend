(function() {

	'use strict';

	var module = angular.module('angularModalService', []);

	module.factory('modal', [
		'$document', '$compile', '$controller', '$http', '$rootScope', '$q', '$templateCache', '$window',
		function($document, $compile, $controller, $http, $rootScope, $q, $templateCache, $window) {

			//  Get the body of the document, we'll add the modal to this.
			var bodyModalCounter = 0;

			function ModalService() {

				var self = this;

				//  Returns a promise which gets the template, either
				//  from the template parameter or via a request to the
				//  template url parameter.
				var getTemplate = function(template, templateUrl) {
					var deferred = $q.defer();
					if (template) {
						deferred.resolve(template);
					} else if (templateUrl) {
						// check to see if the template has already been loaded
						var cachedTemplate = $templateCache.get(templateUrl);
						if (cachedTemplate !== undefined) {
							deferred.resolve(cachedTemplate);
						}
						// if not, let's grab the template for the first time
						else {
							$http({ method: 'GET', url: templateUrl, cache: true })
								.then(function(result) {
									// save template into the cache and return the template
									$templateCache.put(templateUrl, result.data);
									deferred.resolve(result.data);
								}, function(error) {
									deferred.reject(error);
								});
						}
					} else {
						deferred.reject("No template or templateUrl has been specified.");
					}
					return deferred.promise;
				};

				self.checkScrollbar = function() {
					var fullWindowWidth = window.innerWidth;
					if (!fullWindowWidth) { // workaround for missing window.innerWidth in IE8
						var documentElementRect = document.documentElement.getBoundingClientRect();
						fullWindowWidth = documentElementRect.right - Math.abs(documentElementRect.left);
					}
					self.bodyIsOverflowing = document.body.clientWidth < fullWindowWidth;
				}

				self.measureScrollbar = function() {
					var body = $(document.body);
					var scrollDiv = document.createElement('div');
					scrollDiv.className = 'modal-scrollbar-measure';
					body.append(scrollDiv);
					var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
					angular.element(scrollDiv).remove();
					return scrollbarWidth;
				}
				self.scrollbarWidth = self.measureScrollbar();

				self.setScrollbar = function() {
					var body = $(document.body);
					var bodyPad = parseInt((body.css('padding-right') || 0), 10);
					self.originalBodyPad = document.body.style.paddingRight || '';
					if (self.bodyIsOverflowing)
						body.css('padding-right', bodyPad + self.scrollbarWidth + "px");
				}

				self.emitBodyModalState = function() {
					var body = $(document.body);
					if (bodyModalCounter > 0) {
						if (!body.hasClass("body-modal-open")) {
							self.checkScrollbar();
							self.setScrollbar();
						}
						body.addClass("body-modal-open");
					} else {
						body.removeClass("body-modal-open");
						body.css('padding-right', self.originalBodyPad);
					}
				};

				self.show = function(options) {

					//  Create a deferred we'll resolve when the modal is ready.
					var deferred = $q.defer();

					//  Validate the input parameters.
					var controllerName = options.controller;
					if (!controllerName) {
						deferred.reject("No controller has been specified.");
						return deferred.promise;
					}

					//  If a 'controllerAs' option has been provided, we change the controller
					//  name to use 'as' syntax. $controller will automatically handle this.
					if (options.controllerAs) {
						controllerName = controllerName + " as " + options.controllerAs;
					}

					//  Get the actual html of the template.
					getTemplate(options.template, options.templateUrl)
						.then(function(template) {

							//  Create a new scope for the modal.
							var modalScope = $rootScope.$new();

							//  Create the inputs object to the controller - this will include
							//  the scope, as well as all inputs provided.
							//  We will also create a deferred that is resolved with a provided
							//  close function. The controller can then call 'close(result)'.
							//  The controller can also provide a delay for closing - this is
							//  helpful if there are closing animations which must finish first.
							var closeDeferred = $q.defer();
							var inputs = {
								$scope: modalScope,
								close: function(result, delay) {
									if (delay === undefined || delay === null) delay = 0;
									window.setTimeout(function() {
										//  Resolve the 'close' promise.
										closeDeferred.resolve(result);

										//  We can now clean up the scope and remove the element from the DOM.
										modalScope.$destroy();
										modalElement.remove();
										bodyModalCounter--;
										if (bodyModalCounter < 0) {
											bodyModalCounter = 0;
										}
										self.emitBodyModalState();

										//  Unless we null out all of these objects we seem to suffer
										//  from memory leaks, if anyone can explain why then I'd 
										//  be very interested to know.
										inputs.close = null;
										deferred = null;
										closeDeferred = null;
										modal = null;
										inputs = null;
										modalElement = null;
										modalScope = null;
									}, delay);
								}
							};

							//  If we have provided any inputs, pass them to the controller.
							if (options.inputs) {
								for (var inputName in options.inputs) {
									inputs[inputName] = options.inputs[inputName];
								}
							}

							//  Parse the modal HTML into a DOM element (in template form).
							var modalElementTemplate = angular.element(template);

							//  Compile then link the template element, building the actual element.
							//  Set the $element on the inputs so that it can be injected if required.
							var linkFn = $compile(modalElementTemplate);
							var modalElement = linkFn(modalScope);
							inputs.$element = modalElement;

							//  Create the controller, explicitly specifying the scope to use.
							var modalController = $controller(controllerName, inputs);

							//  Finally, append the modal to the dom.
							if (options.appendElement) {
								// append to custom append element
								options.appendElement.append(modalElement);
							} else {
								// append to body when no custom append element is specified
								$(document.body).append(modalElement);
								bodyModalCounter++;
								self.emitBodyModalState();
							}

							//  We now have a modal object...
							var modal = {
								controller: modalController,
								scope: modalScope,
								element: modalElement,
								close: closeDeferred.promise
							};

							//  ...which is passed to the caller via the promise.
							deferred.resolve(modal);

						})
						.then(null, function(error) { // 'catch' doesn't work in IE8.
							deferred.reject(error);
						});

					return deferred.promise;
				};
			}

			return new ModalService();
		}
	]);

}());