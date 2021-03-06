var App;

App = function(config){
    /** @constructor */
    this.config = config;
};

App.prototype.keyConfig = {

    changeSelectionByUpKey: {
        condition: function(event){
            return event.shiftKey && event.which === 38; // up arrow + shift
        },
        behaviour: function(event){
            this.changeSelection({
                up: true
            });
            event.preventDefault();
        }
    },
    changeSelectionByDownKey: {
        condition: function(event){
            return event.shiftKey && event.which === 40;  // down arrow + shift
        },
        behaviour: function(event){
            this.changeSelection({
                down: true
            });
            event.preventDefault();
        }
    },
    moveSelectionUp: {
        condition: function(event){
            return !event.shiftKey && event.which === 38;  // up arrow
        },
        behaviour: function(event){
            this.moveSelection({
                up: true
            });
        }
    },
    moveSelectionDown: {
        condition: function(event){
            return !event.shiftKey && event.which === 40;  // down arrow
        },
        behaviour: function(event){
            this.moveSelection({
                down: true
            });
        }
    },
    removeTask: {
        condition: function(event){
            var target = $(event.target);
            return event.which === 8 && target.is(this.config.selectors.text) && !this.trimTags(target.val());  // backspace key while task has no text
        },
        behaviour: function(event){
            var task = $(event.target).parents(this.config.selectors.listItem).first();
            this.removeTask(task);
        }
    },
    resolveTask: {
        condition: function(event){
            var target = $(event.target);
            return event.which === 81 && event.ctrlKey && target.is(this.config.selectors.text);  // ctrl+Q
        },
        behaviour: function(event){
            var task = $(event.target).parents(this.config.selectors.listItem).first();
            this.resolveTask(task);
        }
    },
    addTask: {
        condition: function(event){
            var target = $(event.target);
            return event.which === 13 && target.is(this.config.selectors.text); // enter
        },
        behaviour: function(event){
            var task = $(event.target).parents(this.config.selectors.listItem);
            this.insertNewTaskAfter(task);
        }
    }
};

App.prototype.init = function(){
    this.is_active = true;
    this.container = $(this.config.selectors.container);
    this.model = new Model({
        url: this.config.url
    });
    this.model.fetch({
        success: $.proxy(function(){
            this.render(
                this.model.toArray(),
                this.container,
                $.proxy(this.bindEvents, this)
            );
        }, this),
        error: $.proxy(function(){
            console.error('Can\'t fetch model');
        }, this)
    });
    this.model.on('change', function(id, changes){
        //console.log('*** model change', id, changes, '|', arguments, this);
    }, this);
    this.model.on('revert', function(){
        console.log('*** model revert', arguments, this);
    }, this);
};

App.prototype.trimTags = function(str){
    return str
        .replace(/(<([^>]+)>)/ig, ' ')
        .replace(/\n\s+/gm, '\n')
        .replace(/ +/gm, ' ')
        .replace(/^\s+/gm, '')
        .replace(/\s+$/gm, '');
};

App.prototype.render = function(data, container, callback){
    if ( data && data.length ) {
        container
            .html(this.getChildTasksHtml(data, 0));
    }
    else {
        var taskId = this.generateTaskId(),
            taskData = {
                id: taskId,
                parent: 0,
                text: this.config.newTaskText,
                start: new Date().toISOString(),
                finish: null,
                done: false,
                order: 0
            },
            taskEl = this.createTask(taskData),
            listEl = this.createList();
        this.model.set(taskId, taskData);

        console.log(listEl);

        this.container.append(listEl);
        listEl.append(taskEl);
        this.bindTaskEvents(taskEl);
        this.setFocusToTask(taskEl);
        this.selectTasks(taskEl);
    }
    callback();
};

App.prototype.getChildTasksHtml = function(data, level){
    var tasks = this.getChildTasks(data, level),
        tasksHtml = [];
    if ( !tasks.length ) {
        return '';
    }
    tasks = this.sortTasks(tasks);
    for ( var i = 0, l = tasks.length; i < l; i++ ) {
        var task = tasks[i],
            taskHtml = _.template(this.config.templates.listItem, _.extend(task, {
                tasksHtml: this.getChildTasksHtml(data, task.id)
            }));
        tasksHtml.push(taskHtml);
    }
    return _.template(this.config.templates.list, {
        tasksHtml: tasksHtml.join('\n')
    });
};

App.prototype.getChildTasks = function(data, level){
    var result = [];
    for ( var i = 0, l = data.length; i < l; i++ ) {
        var task = data[i];
        if ( task.parent === level ) {
            result.push(task);
        }
    }
    return result;
};

App.prototype.sortTasks = function(data){
    return data.sort(function(a,b){
        return a.order < b.order ? -1 : 1;
    });
};

App.prototype.setModel = function(id, params){
    if ( this.is_save_timer ) {
        clearTimeout(this.save_timer);
    }
    params
        ? this.model.set(id, params)
        : this.model.remove(id);
    this.is_save_timer = true;
    this.save_timer = setTimeout($.proxy(function(){
        this.is_save_timer = false;
        this.model.save({
            success: $.proxy(function(){
                console.log('Saved model');
            }, this),
            error:$.proxy(function(data){
                console.error('Can\'t save model', data);
            }, this)
        });
    }, this), 100); // todo: replace timeout with 1000 (?)
};

App.prototype.getTasks = function(ids){
    var tasks = $(this.config.selectors.listItem, this.container),
        result = $();
    if ( !ids ) {
        return tasks;
    }
    ids = ids instanceof Array ? ids : [ids];
    for ( var i = 0, l = ids.length; i < l; i++ ) {
        var task = tasks.filter('[data-id=\'' + ids[i] + '\']');
        result = result.add(task);
    }
    return result;
};

App.prototype.selectTasks = function(taskEls){
    this.getTasks().removeClass(this.config.classes.selected);
    taskEls.addClass(this.config.classes.selected);
    return taskEls;
};

App.prototype.setFocusToTask = function(taskEl){
    taskEl
        .find(this.config.selectors.text)
        .first()
        .focus();
    return taskEl;
};

App.prototype.getSelectedTasks = function(){
    return this.getTasks().filter('.' + this.config.classes.selected);
};

App.prototype.getFocusedTask = function(){
    return this.getTasks().filter('.' + this.config.classes.focused);
};

App.prototype.getTaskIndex = function(taskEl){
    var tasks = this.getTasks();
    for ( var index = 0, l = tasks.length; index < l; index++ ) {
        if ( tasks.eq(index).is(taskEl) ) {
            return index;
        }
    }
};

App.prototype.generateTaskId = function(){
    var model = this.model.toArray(),
        largestId = 0;
    for ( var i = 0, l = model.length; i < l; i++ ) {
        largestId = Math.max(largestId, model[i].id);
    }
    return ++largestId;
};

App.prototype.getTaskId = function(taskEl){
    return +taskEl.data('id') || 0;
};

App.prototype.getParentTask = function(taskEl){
    return taskEl
        .parents(this.config.selectors.listItem)
        .first()
};

App.prototype.getTaskOrder = function(taskEl){
    var defaultOrder = 0;
    return taskEl && taskEl.length
        ? +taskEl.data('order') || defaultOrder
        : defaultOrder;
};

App.prototype.bindEvents = function(){
    var tasks = this.getTasks(),
        handlers = {
            keydown: this.onWindowKeydown,
            click: this.onWindowClick
        };
    this.bindEventsToElement( $(window), handlers );
    tasks.each($.proxy(function(i, element){
        this.bindTaskEvents( $(element) );
    }, this));
    tasks
        .first()
        .addClass(this.config.classes.selected);
    this.setFocusToTask(tasks);
};

App.prototype.bindTaskEvents = function(taskEl){
    var taskInputEl = taskEl.find(this.config.selectors.text),
        handlers = {
            focus: this.onInputStart,
            blur: this.onInputEnd,
            keyup: this.onInput,
            paste: this.onInput,
            mousedown: this.onInputClick
        };
    this.bindEventsToElement(taskInputEl, handlers);
};

App.prototype.bindEventsToElement = function(element, handlers){
    _.each(handlers, function(handler, eventName){
        element._on(eventName, function(event){
            if ( this.is_active ) {
                handler.call(this, event);
            }
        }, this);
    }, this);
};

App.prototype.onWindowKeydown = function(event){
    var config = this.keyConfig;
    for ( var action in config ) {
        if ( config[action].condition.call(this, event) ) {
            config[action].behaviour.call(this, event);
        }
    }
};

App.prototype.onWindowClick = function(event){
    console.log('on window click nothing happens');
};

App.prototype.onInputStart = function(event){
    var element = $(event.currentTarget),
        task = element.parents(this.config.selectors.listItem).first();
    element.data({
        before: this.trimTags(element.html())
    });
    this.getTasks().removeClass(this.config.classes.focused);
    task.addClass(this.config.classes.focused);
};

App.prototype.onInputClick = function(event){
    var element = $(event.currentTarget),
        task = element.parents(this.config.selectors.listItem).first();
    this.selectTasks(task);
};

App.prototype.onInputEnd = function(event){
    //console.log('end: nothing happens', task);
};

App.prototype.onInput = function(event){
    var element = $(event.currentTarget),
        text = this.trimTags(element.val()),
        task,
        id;
    if ( element.data('before') !== text ) {
        element.data({ before: text });
        task = element.parents(this.config.selectors.listItem);
        id = +task.data('id');
        this.setModel(id, {
            text: text
        });
    }
};

App.prototype.changeSelection = function(params){
    var tasks = this.getTasks(),
        selected = this.getSelectedTasks(),
        focused = this.getFocusedTask(),
        focusedIndex = this.getTaskIndex(focused),
        config = {
            addRowAboveToSelection: {
                condition: function(){
                    return ( focused.is(selected.first()) || selected.length === 1 ) && params.up;
                },
                getUpdatedTasks: function(){
                    if ( focusedIndex > 0 ) {
                        var result = selected.add( tasks.eq(--focusedIndex) );
                        return {
                            selected: result,
                            focused: result.first()
                        };
                    }
                }
            },
            addRowBelowToSelection: {
                condition: function(){
                    return ( focused.is(selected.last()) || selected.length === 1 ) && params.down;
                },
                getUpdatedTasks: function(){
                    if ( tasks.length > focusedIndex + 1 ) {
                        var result = selected.add( tasks.eq(++focusedIndex) );
                        return {
                            selected: result,
                            focused: result.last()
                        };
                    }
                }
            },
            removeRowAboveFromSelection: {
                condition: function(){
                    return focused.is(selected.last()) && params.up;
                },
                getUpdatedTasks: function(){
                    var result = selected.not(focused);
                    return {
                        selected: result,
                        focused: result.last()
                    };
                }
            },
            removeRowBelowFromSelection: {
                condition: function(){
                    return focused.is(selected.first()) && params.down;
                },
                getUpdatedTasks: function(){
                    var result = selected.not(focused);
                    return {
                        selected: result,
                        focused: result.first()
                    };
                }
            },
            default: {
                condition: function(){
                    return true;
                },
                getUpdatedTasks: function(){
                    var result = tasks.first();
                    return {
                        selected: result,
                        focused: result
                    };
                }
            }
        };

    for ( var behaviour in config ) {
        if ( config[behaviour].condition() ) {
            var updatedTasks = config[behaviour].getUpdatedTasks();
            if ( updatedTasks && updatedTasks.selected ) {
                this.selectTasks(updatedTasks.selected);
            }
            if ( updatedTasks && updatedTasks.focused ) {
                this.setFocusToTask(updatedTasks.focused);
            }
            return;
        }
    }
};

App.prototype.moveSelection = function(params){
    var tasks = this.getTasks(),
        selected = this.getSelectedTasks(),
        focused = this.getFocusedTask(),
        focusedIndex = this.getTaskIndex(focused),
        next = params.up
            ? tasks.eq(--focusedIndex)
            : tasks.eq(++focusedIndex);

        if ( !next.length ) {
            next = params.up
                ? tasks.last()
                : tasks.first();
        }
    selected.removeClass(this.config.classes.selected);
    this.setFocusToTask(next.addClass(this.config.classes.selected));
    // todo: set caret position in chrome
};

App.prototype.createTask = function(data){
    var taskHtml = _.template(this.config.templates.listItem, data);
    return $(taskHtml);
};

App.prototype.insertNewTaskAfter = function(previousSibling){
    var taskId = this.generateTaskId(),
        parentTaskEl = this.getParentTask(previousSibling),
        taskData = {
            id: taskId,
            parent: this.getTaskId(parentTaskEl),
            text: this.config.newTaskText,
            start: new Date().toISOString(),
            finish: null,
            done: false,
            order: this.getTaskOrder(previousSibling) + 1
        },
        taskEl = this.createTask(taskData);

    console.error('inset new task after', parentTaskEl, this.getTaskId(parentTaskEl));

    this.model.set(taskId, taskData);
    previousSibling.after(taskEl);
    this.bindTaskEvents(taskEl);
    this.setFocusToTask(taskEl);
    this.selectTasks(taskEl);
};

App.prototype.removeTask = function(taskEl){
    var taskId = +taskEl.data('id'),
        taskIndex = this.getTaskIndex(taskEl),
        taskParentEl = taskEl.parent(),
        allTasks = this.getTasks(),
        previousSibling = allTasks.eq(--taskIndex);
    if ( !previousSibling.length ) {
        previousSibling = allTasks.first();
    }
    console.log('--', previousSibling);
    this.setModel(taskId, null);
    this.setFocusToTask(previousSibling);
    taskParentEl.children().length === 1
        ? taskParentEl.remove()
        : taskEl.remove();
};

App.prototype.resolveTask = function(taskEl){
    var taskId = +taskEl.data('id'),
        isDone = taskEl.hasClass(this.config.classes.done);
    this.setModel(taskId, {
        done: !isDone
    });
    taskEl.toggleClass(this.config.classes.done);
};

App.prototype.createList = function(){
    var listHtml = _.template(this.config.templates.list, {});
    return $(listHtml);
};
